import { useState, useCallback, useEffect } from 'react'
import { FolderOpen, ChevronRight, ChevronDown, File, FileText, FileCode, FileJson, Wrench, X, Search, FilePlus, FolderPlus, RefreshCw, Trash2, Terminal, ArrowLeftRight } from 'lucide-react'
import { useCodeStore } from '../../store'
import { authFetch } from '../../utils/auth'
import { FolderBrowser } from './FolderBrowser'
import { PromptDialog } from '../common/PromptDialog'
import type { FileNode } from '../../types'

const FILE_ICONS: Record<string, typeof File> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  py: FileCode,
  rs: FileCode,
  go: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  return FILE_ICONS[ext || ''] || File
}

function FileTreeNode({ node, depth, onCreate, onDelete, onOpenTerminal }: { node: FileNode; depth: number; onCreate: (path: string, type: 'file' | 'folder') => void; onDelete: (path: string, name: string, isDir: boolean) => void; onOpenTerminal: (cwd: string, title: string) => void }) {
  const { openFile, toggleDirectory, activeFile } = useCodeStore()
  const Icon = node.type === 'directory' ? (node.expanded ? ChevronDown : ChevronRight) : getFileIcon(node.name)

  const handleClick = () => {
    if (node.type === 'directory') {
      toggleDirectory(node.path)
    } else {
      openFile(node.path)
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className="dir-node"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          paddingLeft: 14 + depth * 14,
          cursor: 'pointer',
          fontSize: 13,
          color: 'var(--text-secondary)',
          background: activeFile === node.path ? 'var(--accent-light)' : 'transparent',
          borderRadius: 4,
          transition: 'var(--transition)',
        }}
        onMouseEnter={(e) => {
          if (activeFile !== node.path) e.currentTarget.style.background = 'var(--bg-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = activeFile === node.path ? 'var(--accent-light)' : 'transparent'
        }}
      >
        <Icon size={12} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        {node.type === 'directory' && (
          <div className="dir-actions" style={{ display: 'flex', gap: 2, marginLeft: 'auto', transition: 'opacity 0.15s' }}>
            <button
              type="button"
              title="新建文件"
              onClick={(e) => { e.stopPropagation(); onCreate(node.path, 'file') }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'transparent', color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <FilePlus size={12} />
            </button>
            <button
              type="button"
              title="新建文件夹"
              onClick={(e) => { e.stopPropagation(); onCreate(node.path, 'folder') }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'transparent', color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <FolderPlus size={12} />
            </button>
            <button
              type="button"
              title="删除"
              onClick={(e) => { e.stopPropagation(); onDelete(node.path, node.name, true) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'transparent', color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              <Trash2 size={12} />
            </button>
            <button
              type="button"
              title="打开终端"
              onClick={(e) => { e.stopPropagation(); onOpenTerminal(node.path, node.name) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'transparent', color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Terminal size={12} />
            </button>
          </div>
        )}
        {node.type === 'file' && (
          <div className="dir-actions" style={{ display: 'flex', gap: 2, marginLeft: 'auto', transition: 'opacity 0.15s' }}>
            <button
              type="button"
              title="删除"
              onClick={(e) => { e.stopPropagation(); onDelete(node.path, node.name, false) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'transparent', color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      {node.type === 'directory' && node.expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} onCreate={onCreate} onDelete={onDelete} onOpenTerminal={onOpenTerminal} />
          ))}
        </div>
      )}
    </div>
  )
}

export function CodeSidebar() {
  const { fileTree, toolCalls, projectPath, setProjectPath, setFileTree, closeProject, openFile } = useCodeStore()
  const [activeTab, setActiveTab] = useState<'files' | 'tools'>('files')
  const [showBrowser, setShowBrowser] = useState(false)
  const [fileFilter, setFileFilter] = useState('')
  const [projectCollapsed, setProjectCollapsed] = useState(false)
  const [promptOpen, setPromptOpen] = useState<{ title: string; placeholder?: string; callback: (name: string) => void } | null>(null)
  // Separate state for delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string; isDir: boolean } | null>(null)
  const [terminalTarget, setTerminalTarget] = useState<{ cwd: string; title: string } | null>(null)
  const [searchMode, setSearchMode] = useState<'name' | 'content'>('name')
  const [contentResults, setContentResults] = useState<{ path: string; name: string }[]>([])

  const handleOpenFolder = useCallback(async (selectedPath: string) => {
    setProjectPath(selectedPath)
    setShowBrowser(false)

    try {
      const res = await authFetch('/api/files/tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath }),
      })
      if (res.ok) {
        const tree = await res.json()
        setFileTree(tree)
      }
    } catch {}
  }, [setProjectPath, setFileTree])

  // Content search effect: debounced API call
  useEffect(() => {
    if (searchMode !== 'content' || !projectPath || !fileFilter.trim()) {
      setContentResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await authFetch('/api/files/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: projectPath, keyword: fileFilter.trim() }),
        })
        if (res.ok) {
          setContentResults(await res.json())
        }
      } catch {}
    }, 300)
    return () => clearTimeout(timer)
  }, [fileFilter, searchMode, projectPath])

  // Filter file tree: keep nodes matching the filter + their ancestors, auto-expand
  const filterTree = (nodes: FileNode[], filter: string): FileNode[] => {
    if (!filter.trim()) return nodes
    const lower = filter.toLowerCase()
    const result: FileNode[] = []
    for (const node of nodes) {
      const nameMatch = node.name.toLowerCase().includes(lower)
      if (node.type === 'directory' && node.children) {
        const filteredChildren = filterTree(node.children, filter)
        if (nameMatch || filteredChildren.length > 0) {
          result.push({ ...node, children: filteredChildren, expanded: true })
        }
      } else if (nameMatch) {
        result.push(node)
      }
    }
    return result
  }

  const filteredTree = fileFilter.trim() ? filterTree(fileTree, fileFilter) : fileTree

  // Create file or folder
  const handleCreate = useCallback(async (parentPath: string, type: 'file' | 'folder') => {
    const title = type === 'file' ? '新建文件' : '新建文件夹'
    setPromptOpen({
      title,
      placeholder: type === 'file' ? '输入文件名...' : '输入文件夹名...',
      callback: async (name) => {
        setPromptOpen(null)
        try {
          const res = await authFetch('/api/files/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: parentPath, type, name }),
          })
          if (res.ok) {
            const treeRes = await authFetch('/api/files/tree', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: projectPath }),
            })
            if (treeRes.ok) {
              const tree = await treeRes.json()
              setFileTree(tree)
            }
          } else {
            const err = await res.text()
            alert('创建失败: ' + err)
          }
        } catch { alert('创建失败') }
      }
    })
  }, [projectPath, setFileTree])

  // Delete file or folder with confirmation
  const handleDelete = useCallback(async (targetPath: string, name: string, isDir: boolean) => {
    setDeleteTarget({ path: targetPath, name, isDir })
  }, [])

  // Auto-refresh file tree when tools modify files
  useEffect(() => {
    if (!projectPath) return
    const lastCall = toolCalls[toolCalls.length - 1]
    if (!lastCall) return
    const writeOps = ['write_file', 'delete_file', 'create_folder']
    if (!writeOps.includes(lastCall.name)) return
    // Refresh tree
    authFetch('/api/files/tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectPath }),
    }).then(res => { if (res.ok) res.json().then(setFileTree) })
      .catch(() => {})
  }, [toolCalls, projectPath, setFileTree])

  return (
    <>
    <aside
      style={{
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        height: '100%',
        borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setActiveTab('files')}
          style={{
            flex: 1,
            padding: '10px 0',
            fontSize: 12,
            fontWeight: activeTab === 'files' ? 600 : 400,
            color: activeTab === 'files' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            borderBottom: activeTab === 'files' ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent',
            transition: 'var(--transition)',
          }}
        >
          文件
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          style={{
            flex: 1,
            padding: '10px 0',
            fontSize: 12,
            fontWeight: activeTab === 'tools' ? 600 : 400,
            color: activeTab === 'tools' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            borderBottom: activeTab === 'tools' ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent',
            transition: 'var(--transition)',
          }}
        >
          工具
        </button>
      </div>

      {activeTab === 'files' ? (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Search + open folder */}
          <div style={{ padding: '8px 12px', flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <Search size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder={searchMode === 'content' ? '搜索文件内容...' : '搜索文件名...'}
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: 12,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  minWidth: 0,
                }}
              />
              {fileFilter && (
                <button
                  onClick={() => setFileFilter('')}
                  title="清除过滤"
                  style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', flexShrink: 0 }}
                >
                  <X size={12} />
                </button>
              )}
              <button
                onClick={() => { setSearchMode(searchMode === 'name' ? 'content' : 'name'); setFileFilter(''); setContentResults([]) }}
                title={searchMode === 'name' ? '切换到内容搜索' : '切换到文件名搜索'}
                style={{
                  display: 'flex',
                  color: 'var(--text-tertiary)',
                  padding: 2,
                  borderRadius: 3,
                  flexShrink: 0,
                }}
              >
                <ArrowLeftRight size={12} />
              </button>
            </div>
            <button
              onClick={() => setShowBrowser(true)}
              title="打开项目文件夹"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                flexShrink: 0,
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            >
              <FolderOpen size={16} />
            </button>
            {projectPath && (
              <button
                onClick={closeProject}
                title="关闭项目"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  flexShrink: 0,
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Project name with collapse toggle */}
          {projectPath && (
            <div
              className="dir-node"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                flexShrink: 0,
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
              onClick={() => setProjectCollapsed(!projectCollapsed)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                {projectCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectPath.split('/').pop()}</span>
              </div>
              <div className="dir-actions" style={{ display: 'flex', gap: 2, transition: 'opacity 0.15s' }}>
                <button
                  type="button"
                  title="新建文件"
                  onClick={(e) => { e.stopPropagation(); handleCreate(projectPath, 'file') }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'transparent', color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <FilePlus size={12} />
                </button>
                <button
                  type="button"
                  title="新建文件夹"
                  onClick={(e) => { e.stopPropagation(); handleCreate(projectPath, 'folder') }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'transparent', color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <FolderPlus size={12} />
                </button>
                <button
                  type="button"
                  title="刷新文件树"
                  onClick={(e) => { e.stopPropagation(); handleOpenFolder(projectPath) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'transparent', color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  type="button"
                  title="打开终端"
                  onClick={(e) => { e.stopPropagation(); setTerminalTarget({ cwd: projectPath, title: projectPath.split('/').pop() || 'terminal' }) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'transparent', color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Terminal size={12} />
                </button>
              </div>
            </div>
          )}

          {/* File tree or content search results */}
          {searchMode === 'content' && fileFilter.trim() ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
              {contentResults.length > 0 ? (
                contentResults.map((r) => (
                  <div
                    key={r.path}
                    onClick={() => openFile(r.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 8px',
                      paddingLeft: 14,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <FileText size={12} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, padding: '24px 12px' }}>
                  未找到匹配内容
                </div>
              )}
            </div>
          ) : !projectCollapsed ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
            {filteredTree.length > 0 ? (
              filteredTree.map((node) => (
                <FileTreeNode key={node.path} node={node} depth={0} onCreate={handleCreate} onDelete={handleDelete} onOpenTerminal={(cwd, title) => setTerminalTarget({ cwd, title })} />
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, padding: '24px 12px' }}>
                {projectPath ? (fileFilter.trim() ? '未找到匹配的文件名' : '项目为空') : '点击上方按钮打开项目'}
              </div>
            )}
          </div>
          ) : null}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {toolCalls.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, padding: '24px 0' }}>
              暂无工具调用记录
            </div>
          ) : (
            toolCalls.map((call, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  marginBottom: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Wrench size={12} color="var(--text-tertiary)" />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{call.name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: call.status === 'completed' ? 'var(--success-bg)' : call.status === 'error' ? 'var(--error-bg)' : 'var(--bg-tertiary)',
                      color: call.status === 'completed' ? 'var(--success-text)' : call.status === 'error' ? 'var(--error-text)' : 'var(--text-tertiary)',
                    }}
                  >
                    {call.status}
                  </span>
                </div>
                {call.result && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', wordBreak: 'break-all' }}>
                    {call.result.slice(0, 100)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </aside>

    {promptOpen && (
      <PromptDialog
        title={promptOpen.title}
        placeholder={promptOpen.placeholder}
        onConfirm={promptOpen.callback}
        onCancel={() => setPromptOpen(null)}
      />
    )}

    {deleteTarget && (
      <PromptDialog
        title={deleteTarget.isDir ? `确认删除 "${deleteTarget.name}" 文件夹及其内部所有内容？` : `确认删除 "${deleteTarget.name}" 文件？`}
        requireInput={false}
        confirmLabel="删除"
        onConfirm={() => {
          if (!deleteTarget) return
          const targetPath = deleteTarget.path
          setDeleteTarget(null)
          authFetch('/api/files/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath }),
          }).then(res => {
            if (res.ok) {
              return authFetch('/api/files/tree', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: projectPath }),
              }).then(r => r.json()).then(tree => setFileTree(tree))
            }
            throw new Error('delete failed')
          }).catch(() => alert('删除失败'))
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    )}

    {terminalTarget && (
      <PromptDialog
        title={`在 "${terminalTarget.title}" 中打开终端？`}
        requireInput={false}
        confirmLabel="打开"
        onConfirm={() => {
          const { cwd, title } = terminalTarget
          useCodeStore.getState().openTerminal(cwd, title)
          setTerminalTarget(null)
        }}
        onCancel={() => setTerminalTarget(null)}
      />
    )}

    {showBrowser && (
      <FolderBrowser
        onSelect={handleOpenFolder}
        onClose={() => setShowBrowser(false)}
      />
    )}
    </>
  )
}
