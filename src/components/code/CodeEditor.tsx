import { useEffect, useCallback, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { X, FileCode } from 'lucide-react'
import { useCodeStore, useAppStore } from '../../store'
import { authFetch } from '../../utils/auth'
import { TabContextMenu } from './TabContextMenu'
import { TerminalPanel } from './TerminalPanel'

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', json: 'json', md: 'markdown',
  css: 'css', html: 'html', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  sh: 'shell', bash: 'shell', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  java: 'java', rb: 'ruby', php: 'php', sql: 'sql', xml: 'xml', txt: 'plaintext',
}

function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return LANG_MAP[ext] || 'plaintext'
}

// Tab bar component to use in both panes
function TabBar({ files, active, onSelect, onClose, onContextMenu, onDragStart, onDragEnd, onDragOver, onDrop, missingFiles }: {
  files: string[]
  active: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
  onContextMenu: (e: React.MouseEvent, path: string, index: number) => void
  onDragStart: (e: React.DragEvent, index: number) => void
  onDragEnd: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, path: string) => void
  missingFiles: Record<string, boolean>
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', flexShrink: 0, minHeight: 36 }}>
      {files.map((path, index) => {
        const name = path.split('/').pop() || path
        const isActive = path === active
        return (
          <div
            key={path}
            onClick={() => onSelect(path)}
            draggable
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, path, index) }}
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              fontSize: 12, color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              textDecoration: missingFiles[path] ? 'line-through' : 'none',
              textDecorationThickness: missingFiles[path] ? '1px' : undefined,
              textDecorationColor: missingFiles[path] ? 'var(--danger)' : undefined,
              transition: 'var(--transition)',
            }}
          >
            {name}
            <button onClick={(e) => { e.stopPropagation(); onClose(path) }} title="关闭标签页" style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 0, borderRadius: 3 }}>
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function CodeEditor() {
  const { theme } = useAppStore()
  const { openFiles, activeFile, closeFile, setActiveFile, projectPath, fileTree, fileContents, setFileContent, missingFiles, markFileMissing, clearFileMissing, reorderOpenFiles, splitMode = false, rightPaneFiles = [], rightPaneActive = null, splitFileRight, closeRightFile, setRightPaneActive, setSplitRatio, disableSplit, splitRatio = 0.5 } = useCodeStore()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; filePath: string; index: number; isRight: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dividerRef = useRef<HTMLDivElement>(null)

  const loadFile = useCallback(async (path: string) => {
    if (fileContents[path] !== undefined) return
    try {
      const res = await authFetch('/api/files/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) })
      if (res.ok) { const data = await res.json(); setFileContent(path, data.content) }
      else { markFileMissing(path) }
    } catch { markFileMissing(path) }
  }, [fileContents, setFileContent, markFileMissing])

  useEffect(() => { if (activeFile) loadFile(activeFile) }, [activeFile, loadFile])
  useEffect(() => { if (rightPaneActive && splitMode) loadFile(rightPaneActive) }, [rightPaneActive, loadFile, splitMode])

  useEffect(() => {
    if (!projectPath || (openFiles.length === 0 && rightPaneFiles.length === 0)) return
    const check = async () => {
      for (const fpath of [...openFiles, ...rightPaneFiles]) {
        try {
          const res = await authFetch('/api/files/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: fpath }) })
          if (res.ok) { clearFileMissing(fpath) } else { markFileMissing(fpath) }
        } catch { markFileMissing(fpath) }
      }
    }
    check()
  }, [fileTree])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFile = useCallback(async (p: string, c: string) => {
    try { await authFetch('/api/files/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p, content: c }) }) } catch {}
  }, [])

  const handleEditorChange = (value: string | undefined, isRight: boolean) => {
    const f = isRight ? rightPaneActive : activeFile
    if (f && value !== undefined) {
      setFileContent(f, value)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => saveFile(f, value), 800)
    }
  }

  // Divider drag
  const handleDividerDown = useCallback(() => {
    setDragging(true)
    const onMove = (e: MouseEvent) => {
      const container = dividerRef.current?.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      setSplitRatio(ratio)
    }
    const onUp = () => { setDragging(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [setSplitRatio])

  // drag helpers for left pane
  const dragStartLeft = (e: React.DragEvent, i: number) => { e.dataTransfer.setData('text/left', String(i)); (e.currentTarget as HTMLElement).style.opacity = '0.5' }
  const dragEndLeft = (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = '1' }
  const dragOverLeft = (e: React.DragEvent) => { e.preventDefault() }
  const dropLeft = (e: React.DragEvent, path: string) => {
    e.preventDefault()
    const from = parseInt(e.dataTransfer.getData('text/left'))
    const to = openFiles.indexOf(path)
    if (from !== to && !isNaN(from)) reorderOpenFiles(from, to)
  }

  const ctxLeft = (e: React.MouseEvent, path: string, index: number) => setContextMenu({ x: e.clientX, y: e.clientY, filePath: path, index, isRight: false })
  const ctxRight = (e: React.MouseEvent, path: string, index: number) => setContextMenu({ x: e.clientX, y: e.clientY, filePath: path, index, isRight: true })

  const leftFiles = splitMode ? openFiles : openFiles
  const leftActive = splitMode ? activeFile : activeFile

  const emptyState = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-tertiary)', background: 'var(--bg-primary)' }}>
      <FileCode size={40} strokeWidth={1} style={{ opacity: 0.3 }} />
      <div style={{ fontSize: 14 }}>打开文件开始编辑</div>
      {projectPath && <div style={{ fontSize: 12, opacity: 0.6 }}>{projectPath}</div>}
    </div>
  )

  if (!splitMode && openFiles.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {emptyState}
        <TerminalPanel />
      </div>
    )
  }

  // ...rest of render with TerminalPanel

  const editorOptions = {
    fontSize: 14, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    minimap: { enabled: true, scale: 1 }, scrollBeyondLastLine: false, wordWrap: 'off' as const,
    automaticLayout: true, tabSize: 2, lineNumbers: 'on' as const, renderLineHighlight: 'all' as const,
    bracketPairColorization: { enabled: true },
    suggest: { showKeywords: true, showSnippets: true },
    quickSuggestions: true, formatOnPaste: true, formatOnType: true,
    padding: { top: 12, bottom: 12 },
  }

  const renderPane = (files: string[], active: string | null, isRight: boolean) => (
    <div style={{ flex: isRight ? `1 1 ${(1 - splitRatio) * 100}%` : `1 1 ${splitRatio * 100}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TabBar
        files={files}
        active={active}
        onSelect={isRight ? setRightPaneActive : setActiveFile}
        onClose={isRight ? closeRightFile : closeFile}
        onContextMenu={isRight ? ctxRight : ctxLeft}
        onDragStart={isRight ? () => {} : dragStartLeft}
        onDragEnd={isRight ? () => {} : dragEndLeft}
        onDragOver={isRight ? () => {} : dragOverLeft}
        onDrop={isRight ? () => {} : dropLeft}
        missingFiles={missingFiles}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {active && (
          <Editor key={active + (isRight ? '-r' : '-l')} language={getLang(active)} value={fileContents[active] || ''}
            onChange={(v) => handleEditorChange(v, isRight)} theme={theme === 'dark' ? 'vs-dark' : 'vs'} options={editorOptions}
            loading={<div style={{ padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>加载编辑器...</div>}
          />
        )}
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <div ref={dividerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
      {renderPane(leftFiles, leftActive, false)}
      {splitMode && (
        <>
          <div
            onMouseDown={handleDividerDown}
            style={{ width: 4, cursor: 'col-resize', background: dragging ? 'var(--accent)' : 'var(--border-color)', flexShrink: 0, transition: dragging ? 'none' : 'background 0.2s' }}
          />
          {renderPane(rightPaneFiles, rightPaneActive, true)}
        </>
      )}
    </div>
    <TerminalPanel />
    {contextMenu && (
      <TabContextMenu
        x={contextMenu.x} y={contextMenu.y}
        onClose={() => setContextMenu(null)}
        onCloseCurrent={() => contextMenu.isRight ? closeRightFile(contextMenu.filePath) : closeFile(contextMenu.filePath)}
        onCloseOthers={() => {
          const { filePath, isRight } = contextMenu
          if (isRight) {
            rightPaneFiles.filter(f => f !== filePath).forEach(f => closeRightFile(f))
          } else {
            openFiles.filter(f => f !== filePath).forEach(f => closeFile(f))
          }
        }}
        onCloseRight={() => {
          const { index, isRight } = contextMenu
          if (isRight) {
            rightPaneFiles.slice(index + 1).forEach(f => closeRightFile(f))
          } else {
            openFiles.slice(index + 1).forEach(f => closeFile(f))
          }
        }}
        onCloseAll={() => {
          if (contextMenu.isRight) {
            rightPaneFiles.forEach(f => closeRightFile(f))
          } else {
            openFiles.forEach(f => closeFile(f))
          }
        }}
        onSplitRight={() => splitFileRight(contextMenu.filePath)}
        hasRightTabs={
          contextMenu.isRight
            ? contextMenu.index < rightPaneFiles.length - 1
            : contextMenu.index < openFiles.length - 1
        }
        hasOtherTabs={
          contextMenu.isRight
            ? rightPaneFiles.length > 1
            : openFiles.length > 1
        }
        showSplit={!contextMenu.isRight}
      />
    )}
    </div>
  )
}
