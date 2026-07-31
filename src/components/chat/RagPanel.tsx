
import { useState, useEffect } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, X, BookOpen, Check } from 'lucide-react'
import { useApiStore } from '../../store'
import { authFetch } from '../../utils/auth'
import { FolderBrowser } from '../code/FolderBrowser'

interface RagKB {
  id: string; name: string; chunkCount: number; chatEnabled: boolean; codeEnabled: boolean; createdAt: string
}

export function RagPanel({ onClose }: { onClose: () => void }) {
  const { providers } = useApiStore()
  const [kbs, setKbs] = useState<RagKB[]>([])
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [formName, setFormName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [showBrowser, setShowBrowser] = useState(false)
  const [formProvider, setFormProvider] = useState(providers.find(p => p.configured)?.id || '')
  const [formModel, setFormModel] = useState('text-embedding-3-small')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const configuredProviders = providers.filter(p => p.configured)

  const fetchKbs = async () => {
    try {
      const res = await authFetch('/api/rag/knowledge')
      if (res.ok) setKbs(await res.json())
    } catch {}
  }

  useEffect(() => { fetchKbs() }, [])
  useEffect(() => {
    if (mode === 'add') {
      setFormName('')
      setSelectedFiles([])
      setError('')
      setFormProvider(providers.find(p => p.configured)?.id || '')
      setFormModel('text-embedding-3-small')
    }
  }, [mode])

  const handleSave = async () => {
    if (!formName.trim() || selectedFiles.length === 0) return
    setSaving(true)
    setError('')
    try {
      const res = await authFetch('/api/rag/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          filePaths: selectedFiles,
          provider: formProvider,
          model: formModel,
        }),
      })
      if (res.ok) {
        setMode('list')
        fetchKbs()
      } else {
        const data = await res.json()
        setError(data.error || '创建失败')
      }
    } catch {
      setError('请求失败')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await authFetch(`/api/rag/knowledge/${id}`, { method: 'DELETE' })
    fetchKbs()
  }

  const handleToggle = async (id: string, field: 'chatEnabled' | 'codeEnabled', value: boolean) => {
    setKbs((prev) => prev.map((k) => k.id === id ? { ...k, [field]: !value } : k))
    await authFetch(`/api/rag/knowledge/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !value }),
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ width: 560, maxHeight: '75vh', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color="var(--text-primary)" />
            <span style={{ fontSize: 15, fontWeight: 600 }}>{mode === 'add' ? '新建知识库' : 'RAG 知识库'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginRight: 8, alignItems: 'center' }}>
            {mode === 'list' && (
              <button onClick={() => setMode('add')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', fontSize: 12 }}>
                <Plus size={14} /> 添加
              </button>
            )}
            <button onClick={onClose} title="关闭" style={{ display: 'flex', background: 'transparent', color: 'var(--text-secondary)' }}><X size={18} /></button>
          </div>
        </div>

        {mode === 'add' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>名称</label>
              <input placeholder="如: 技术文档" value={formName} onChange={(e) => setFormName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Embedding 模型</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={formProvider} onChange={(e) => { setFormProvider(e.target.value); setFormModel('text-embedding-3-small') }}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 12, color: 'var(--text-primary)' }}>
                  {configuredProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={formModel} onChange={(e) => setFormModel(e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 12, color: 'var(--text-primary)' }}
                  placeholder="text-embedding-3-small" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>文件</label>
              <button onClick={() => setShowBrowser(true)}
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 8 }}>
                浏览选择...
              </button>
              {selectedFiles.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', maxHeight: 120, overflowY: 'auto' }}>
                  {selectedFiles.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
                      <Check size={10} color="var(--success)" />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                      <button onClick={() => setSelectedFiles(prev => prev.filter(p => p !== f))} title="移除" style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 0 }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div style={{ color: 'var(--error-text)', fontSize: 12, marginBottom: 16 }}>{error}</div>}
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20 }}>
              文件将被分块、向量化并存储。使用已配置的模型 API 进行 Embedding。仅限主目录内的文件。
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMode('list')} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 12 }}>取消</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: saving ? 'var(--bg-tertiary)' : 'var(--accent)', color: saving ? 'var(--text-tertiary)' : '#fff', fontSize: 12 }}>
                {saving ? '构建中...' : '构建知识库'}
              </button>
            </div>
          </div>
        )}

        {mode === 'list' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
            {kbs.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0', fontSize: 13 }}>暂无知识库，点击"添加"构建</div>
            )}
            {kbs.map((kb) => (
              <div key={kb.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{kb.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{kb.chunkCount} chunks</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                  <button onClick={() => handleToggle(kb.id, 'chatEnabled', kb.chatEnabled)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'transparent', color: kb.chatEnabled ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 11, padding: '2px 4px', borderRadius: 4, opacity: kb.chatEnabled ? 1 : 0.5 }}>
                    {kb.chatEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />} 聊天
                  </button>
                  <button onClick={() => handleToggle(kb.id, 'codeEnabled', kb.codeEnabled)} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'transparent', color: kb.codeEnabled ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 11, padding: '2px 4px', borderRadius: 4, opacity: kb.codeEnabled ? 1 : 0.5 }}>
                    {kb.codeEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />} 编程
                  </button>
                  <button onClick={() => handleDelete(kb.id)} title="删除" style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showBrowser && <FolderBrowser selectFiles onSelectFiles={(paths) => { setSelectedFiles(paths); setShowBrowser(false) }} onClose={() => setShowBrowser(false)} />}
    </div>
  )
}
