import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Plus, X, Trash2 } from 'lucide-react'
import { useCodeStore, useAppStore } from '../../store'
import '@xterm/xterm/css/xterm.css'

export function TerminalPanel() {
  const { terminalSessions, terminalActiveId, terminalOpen, terminalHeight, openTerminal, closeTerminal, setTerminalActive, setTerminalHeight, updateTerminalTitle, reorderTerminals } = useCodeStore()
  const { theme } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const instancesRef = useRef<Map<string, { term: Terminal; ws: WebSocket; fit: FitAddon; cwd: string }>>(new Map())
  const [dragging, setDragging] = useState(false)

  const active = terminalSessions.find(s => s.id === terminalActiveId)

  const isDark = theme === 'dark'
  const termTheme = isDark
    ? { background: '#1a1a1a', foreground: '#e5e5e5', cursor: '#e5e5e5' }
    : { background: '#ffffff', foreground: '#1a1a1a', cursor: '#1a1a1a' }

  // Create terminal for new session
  const createTerminal = useCallback((session: { id: string; cwd: string }) => {
    if (instancesRef.current.has(session.id)) return

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${wsProtocol}//${location.hostname}:3210/ws/terminal`)

    const termDiv = document.createElement('div')
    termDiv.style.width = '100%'
    termDiv.style.height = '100%'
    termDiv.style.display = 'none'
    containerRef.current?.appendChild(termDiv)

    const t = new Terminal({
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: termTheme,
      cursorBlink: true,
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    t.loadAddon(fit)
    t.open(termDiv)
    setTimeout(() => fit.fit(), 100)

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'init', cwd: session.cwd, cols: t.cols, rows: t.rows }))
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'data') t.write(msg.data)
        if (msg.type === 'cwd') {
          instancesRef.current.get(session.id)!.cwd = msg.cwd
          updateTerminalTitle(session.id, msg.title)
        }
        if (msg.type === 'exit') {
          t.write('\r\n[进程已退出]\r\n')
          closeTerminal(msg.id)
        }
      } catch {}
    }

    t.onData((data) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'input', data }))
    })

    t.onResize(({ cols, rows }) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    })

    instancesRef.current.set(session.id, { term: t, ws, fit, cwd: session.cwd })

    // Show the active one
    if (session.id === terminalActiveId) termDiv.style.display = ''
  }, [termTheme, terminalActiveId, closeTerminal, updateTerminalTitle])

  // Create new terminals for sessions not yet created
  useEffect(() => {
    terminalSessions.forEach(s => createTerminal(s))
  }, [terminalSessions])

  // Show/hide based on active
  useEffect(() => {
    instancesRef.current.forEach((inst, id) => {
      const el = inst.term.element?.parentElement
      if (el) el.style.display = id === terminalActiveId ? '' : 'none'
      if (id === terminalActiveId) {
        setTimeout(() => inst.fit.fit(), 50)
      }
    })
  }, [terminalActiveId])

  // Update theme on all terminals when mode changes
  useEffect(() => {
    instancesRef.current.forEach(inst => {
      inst.term.options.theme = termTheme
    })
  }, [theme, termTheme])
  useEffect(() => {
    return () => {
      instancesRef.current.forEach((inst) => {
        inst.ws.close()
        inst.term.dispose()
      })
      instancesRef.current.clear()
    }
  }, [])
  useEffect(() => {
    const activeIds = new Set(terminalSessions.map(s => s.id))
    instancesRef.current.forEach((inst, id) => {
      if (!activeIds.has(id)) {
        inst.ws.close()
        inst.term.dispose()
        instancesRef.current.delete(id)
      }
    })
  }, [terminalSessions])

  // Fit on resize
  useEffect(() => {
    instancesRef.current.forEach(inst => {
      if (inst.term.element) setTimeout(() => inst.fit.fit(), 100)
    })
  }, [terminalHeight])

  const handleDividerDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    const startY = e.clientY
    const startH = terminalHeight
    const onMove = (ev: MouseEvent) => {
      const diff = startY - ev.clientY
      setTerminalHeight(startH + diff)
    }
    const onUp = () => { setDragging(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [terminalHeight, setTerminalHeight])

  if (!terminalOpen) return null

  return (
    <>
      <div
        onMouseDown={handleDividerDown}
        style={{ height: 4, cursor: 'ns-resize', background: dragging ? 'var(--accent)' : 'var(--border-color)', flexShrink: 0, transition: dragging ? 'none' : 'background 0.2s' }}
      />
      <div style={{ height: terminalHeight, display: 'flex', flexDirection: 'column', background: termTheme.background, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: isDark ? '#2a2a2a' : '#f0f1f3', borderBottom: `1px solid ${isDark ? '#3a3a3a' : '#e0e0e0'}`, padding: '0 4px', minHeight: 28, flexShrink: 0 }}>
          <div style={{ display: 'flex', flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
            {terminalSessions.map((s, index) => (
              <div
                key={s.id}
                onClick={() => setTerminalActive(s.id)}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/term', String(index)); (e.currentTarget as HTMLElement).style.opacity = '0.5' }}
                onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = parseInt(e.dataTransfer.getData('text/term'))
                  const to = terminalSessions.indexOf(s)
                  if (from !== to && !isNaN(from)) reorderTerminals(from, to)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11,
                  color: s.id === terminalActiveId ? (isDark ? '#e5e5e5' : '#1a1a1a') : (isDark ? '#888' : '#999'),
                  cursor: 'pointer',
                  borderBottom: s.id === terminalActiveId ? '2px solid #5c77ff' : '2px solid transparent',
                  background: s.id === terminalActiveId ? termTheme.background : 'transparent',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{s.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeTerminal(s.id) }}
                  title="关闭终端"
                  style={{ display: 'flex', background: 'transparent', color: isDark ? '#888' : '#999', padding: 0, borderRadius: 3 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#e5e5e5' : '#1a1a1a')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#888' : '#999')}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
          {active && (
            <>
              <button
                onClick={() => openTerminal(instancesRef.current.get(active.id)?.cwd || active.cwd, active.title)}
                title="新建终端"
                style={{ display: 'flex', background: 'transparent', color: isDark ? '#888' : '#999', padding: 4, borderRadius: 3 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#e5e5e5' : '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#888' : '#999')}
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => { terminalSessions.forEach(s => closeTerminal(s.id)) }}
                title="关闭所有终端"
                style={{ display: 'flex', background: 'transparent', color: isDark ? '#888' : '#999', padding: 4, borderRadius: 3 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#888' : '#999')}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
        <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }} />
      </div>
    </>
  )
}
