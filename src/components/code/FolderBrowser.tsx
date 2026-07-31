
import { useState, useEffect, useCallback } from 'react'
import { Folder, FileText, ChevronRight, ArrowUp, X, Check } from 'lucide-react'
import { authFetch } from '../../utils/auth'

interface BrowseResult {
  current: string
  parent: string | null
  dirs: { name: string; path: string }[]
  files: { name: string; path: string }[]
}

export function FolderBrowser({
  onSelect,
  onClose,
  selectFiles,
  onSelectFiles,
}: {
  onSelect?: (path: string) => void
  onClose: () => void
  selectFiles?: boolean
  onSelectFiles?: (paths: string[]) => void
}) {
  const [currentPath, setCurrentPath] = useState('')
  const [dirs, setDirs] = useState<{ name: string; path: string }[]>([])
  const [files, setFiles] = useState<{ name: string; path: string }[]>([])
  const [parent, setParent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputPath, setInputPath] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const browse = useCallback(async (dirPath: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/files/browse?path=${encodeURIComponent(dirPath)}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '加载失败')
        return
      }
      const data: BrowseResult = await res.json()
      setCurrentPath(data.current)
      setInputPath(data.current)
      setParent(data.parent)
      setDirs(data.dirs)
      setFiles(data.files || [])
    } catch {
      setError('网络错误')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    authFetch('/api/system/home')
      .then(res => res.json())
      .then(data => {
        if (data.home) {
          setCurrentPath(data.home)
          setInputPath(data.home)
          browse(data.home)
        }
      })
      .catch(() => setError('无法获取主目录'))
  }, [])

  const toggleFile = (path: string) => {
    const next = new Set(selected)
    next.has(path) ? next.delete(path) : next.add(path)
    setSelected(next)
  }

  const handleConfirm = () => {
    if (onSelectFiles) {
      onSelectFiles(Array.from(selected))
      onClose()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ width: 520, maxHeight: '70vh', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectFiles ? '选择文件' : '选择项目文件夹'}</span>
          <button type="button" onClick={onClose} title="关闭" style={{ display: 'flex', background: 'transparent', color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>

        {!selectFiles && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <button type="button" onClick={() => parent && browse(parent)} disabled={!parent} title="上一级" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--bg-tertiary)', color: parent ? 'var(--text-secondary)' : 'var(--text-tertiary)', opacity: parent ? 1 : 0.5, flexShrink: 0 }}>
            <ArrowUp size={14} />
          </button>
          <input value={inputPath} onChange={(e) => setInputPath(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') browse(inputPath.trim()) }}
            style={{ flex: 1, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12 }} />
        </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', minHeight: 200 }}>
          {loading ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0', fontSize: 12 }}>加载中...</div>
          : error ? <div style={{ textAlign: 'center', color: 'var(--danger)', padding: '32px 0', fontSize: 12 }}>{error}</div>
          : dirs.length === 0 && files.length === 0 ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0', fontSize: 12 }}>空目录</div>
          : (
            <>
              {selectFiles && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}>
                  <button onClick={() => parent && browse(parent)} disabled={!parent} title="上一级" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 4, background: 'var(--bg-tertiary)', color: parent ? 'var(--text-secondary)' : 'var(--text-tertiary)', flexShrink: 0 }}>
                    <ArrowUp size={12} />
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentPath}</span>
                </div>
              )}
              {dirs.map((d) => (
                <div key={d.path} onClick={() => browse(d.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', transition: 'var(--transition)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <Folder size={14} color="var(--text-tertiary)" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <ChevronRight size={14} color="var(--text-tertiary)" />
                </div>
              ))}
              {selectFiles && files.map((f) => (
                <div key={f.path} onClick={() => toggleFile(f.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, color: selected.has(f.path) ? 'var(--accent)' : 'var(--text-primary)', background: selected.has(f.path) ? 'var(--accent-light)' : 'transparent', transition: 'var(--transition)' }}
                  onMouseEnter={(e) => { if (!selected.has(f.path)) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={(e) => { if (!selected.has(f.path)) e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${selected.has(f.path) ? 'var(--accent)' : 'var(--text-tertiary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>
                    {selected.has(f.path) && <Check size={10} />}
                  </span>
                  <FileText size={14} color="var(--text-tertiary)" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: selectFiles ? 'flex-end' : 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border-color)' }}>
          {!selectFiles && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{currentPath}</span>
          )}
          {selectFiles ? (
            <button type="button" onClick={handleConfirm} disabled={selected.size === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 16px', borderRadius: 'var(--radius-sm)', background: selected.size > 0 ? 'var(--accent)' : 'var(--bg-tertiary)', color: selected.size > 0 ? '#fff' : 'var(--text-tertiary)', fontSize: 12, fontWeight: 500 }}>
              <Check size={14} /> 确认 ({selected.size} 个文件)
            </button>
          ) : (
            <button type="button" onClick={() => { onSelect?.(currentPath); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 500 }}>
              <Check size={14} /> 打开此文件夹
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
