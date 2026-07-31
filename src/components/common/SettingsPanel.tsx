import { useState, useRef, useEffect } from 'react'
import { X, Eye, EyeOff, Check, Save, ArrowLeft, Cpu, Key, Plug, Plus, ToggleLeft, ToggleRight, Trash2, Search, BookOpen } from 'lucide-react'
import { useApiStore } from '../../store'
import { authFetch } from '../../utils/auth'

type Page = 'list' | 'params' | 'api' | 'mcp' | 'websearch'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { providers, modelParams, setModelParams, saveApiKey, saveBaseUrl } = useApiStore()
  const [page, setPage] = useState<Page>('list')
  const [mcpMode, setMcpMode] = useState<'list' | 'add'>('list')
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        const current = editValuesRef.current
        for (const [id, val] of Object.entries(current)) {
          if (val !== undefined) saveBaseUrl(id, val)
        }
      }
    }
  }, [saveBaseUrl])
  const editValuesRef = useRef<Record<string, string>>({})

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSave = (id: string) => {
    const val = editValues[id]
    if (val !== undefined) {
      saveApiKey(id, val)
      setSaved((prev) => ({ ...prev, [id]: true }))
      setTimeout(() => setSaved((prev) => ({ ...prev, [id]: false })), 1500)
    }
  }

  const title = page === 'list' ? '设置' : page === 'params' ? '全局参数设置' : page === 'api' ? 'API 配置' : page === 'websearch' ? '搜索 & Embedding' : 'MCP Servers'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 560,
          maxHeight: '80vh',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {page !== 'list' && (
              <button
                onClick={() => { setPage('list'); setMcpMode('list') }} 
                style={{ display: 'flex', background: 'transparent', color: 'var(--text-secondary)' }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginRight: 8, alignItems: 'center' }}>
            {page === 'mcp' && (
              <button
                onClick={() => setMcpMode('add')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                <Plus size={14} /> 添加
              </button>
            )}
          <button
            onClick={onClose}
            title="关闭设置"
            style={{ display: 'flex', background: 'transparent', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
          </div>
        </div>

        {/* List page */}
        {page === 'list' && (
          <div style={{ padding: '8px 0' }}>
            <button
              onClick={() => setPage('params')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '14px 20px',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 14,
                textAlign: 'left',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Cpu size={16} style={{ opacity: 0.6 }} />
              全局参数设置
            </button>
            <button
              onClick={() => setPage('api')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '14px 20px',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 14,
                textAlign: 'left',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Key size={16} style={{ opacity: 0.6 }} />
              API 配置
            </button>
            <button
              onClick={() => setPage('mcp')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '14px 20px',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 14,
                textAlign: 'left',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Plug size={16} style={{ opacity: 0.6 }} />
              MCP Servers
            </button>
            <button
              onClick={() => setPage('websearch')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '14px 20px',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 14,
                textAlign: 'left',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Search size={16} style={{ opacity: 0.6 }} />
              网页搜索 & Embedding
            </button>
          </div>
        )}

        {/* Params page */}
        {page === 'params' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>工具调用轮数</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" min={1} max={50} value={modelParams.maxToolRounds} onChange={(e) => {
                  const v = parseInt(e.target.value) || 10
                  setModelParams({ ...modelParams, maxToolRounds: Math.max(1, Math.min(50, v)) })
                }}
                  style={{ width: 70, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'center', MozAppearance: 'textfield' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>1 - 50</span>
              </div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Temperature</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" min={0} max={2} step={0.1} value={modelParams.temperature} onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0.7
                  setModelParams({ ...modelParams, temperature: Math.max(0, Math.min(2, v)) })
                }} style={{ width: 70, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'center', MozAppearance: 'textfield' }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>0 - 2</span>
              </div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Top P</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" min={0} max={1} step={0.05} value={modelParams.top_p} onChange={(e) => {
                  const v = parseFloat(e.target.value) || 1.0
                  setModelParams({ ...modelParams, top_p: Math.max(0, Math.min(1, v)) })
                }} style={{ width: 70, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'center', MozAppearance: 'textfield' }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>0 - 1</span>
              </div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Max Tokens</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" min={256} max={16384} step={256} value={modelParams.max_tokens} onChange={(e) => {
                  const v = parseInt(e.target.value) || 4096
                  setModelParams({ ...modelParams, max_tokens: Math.max(256, Math.min(16384, v)) })
                }} style={{ width: 70, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'center', MozAppearance: 'textfield' }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>256 - 16384</span>
              </div>
            </div>
          </div>
        )}

        {/* API config page */}
        {page === 'api' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              填入 API Key 后自动保存到 config.json，对应厂商即变为可用状态。
            </div>
            {providers.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-color)',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <img
                    src={p.icon}
                    alt={p.name}
                    style={{ width: 20, height: 20, borderRadius: 4 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                  {p.configured && (
                    <span style={{ fontSize: 11, color: 'var(--success-text)', marginLeft: 'auto' }}>已接入</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      padding: '0 10px',
                    }}
                  >
                    <input
                      type={showKeys[p.id] ? 'text' : 'password'}
                      placeholder="API Key"
                      defaultValue={p.apiKey}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      style={{ flex: 1, fontSize: 13, padding: '7px 0', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)' }}
                    />
                    <button
                      onClick={() => toggleShowKey(p.id)}
                      title="显示/隐藏"
                      style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 4 }}
                    >
                      {showKeys[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleSave(p.id)}
                    title="保存密钥"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: saved[p.id] ? 'var(--success)' : 'var(--accent)',
                      color: '#fff',
                      transition: 'var(--transition)',
                      flexShrink: 0,
                    }}
                  >
                    {saved[p.id] ? <Check size={16} /> : <Save size={16} />}
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    padding: '0 10px',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 6, flexShrink: 0 }}>URL</span>
                  <input
                    type="text"
                    defaultValue={p.baseUrl}
                    onChange={(e) => {
                      const val = e.target.value
                      editValuesRef.current[p.id] = val
                      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                      saveTimerRef.current = setTimeout(() => {
                        for (const [id, v] of Object.entries(editValuesRef.current)) {
                          if (v !== undefined) saveBaseUrl(id, v)
                        }
                        editValuesRef.current = {}
                      }, 800)
                    }}
                    style={{ flex: 1, fontSize: 12, padding: '6px 0', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-secondary)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MCP page */}
        {page === 'mcp' && <McpPage mode={mcpMode} setMode={setMcpMode} />}
        {page === 'websearch' && <WebSearchPage />
        }
      </div>
    </div>
  )
}

function McpPage({ mode, setMode }: { mode: 'list' | 'add'; setMode: (m: 'list' | 'add') => void }) {
  const [servers, setServers] = useState<Array<{ id: string; name: string; type: string; url: string; command: string; args: string[]; env: Record<string, string>; token: string; enabled: boolean }>>([])
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'http' | 'stdio'>('stdio')
  const [formUrl, setFormUrl] = useState('')
  const [formCommand, setFormCommand] = useState('')
  const [formArgs, setFormArgs] = useState('')
  const [formToken, setFormToken] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchServers = async () => {
    try {
      const res = await authFetch('/api/mcp/servers')
      if (res.ok) setServers(await res.json())
    } catch {}
  }

  useEffect(() => { fetchServers() }, [])
  useEffect(() => {
    if (mode === 'add') { setFormName(''); setFormType('stdio'); setFormUrl(''); setFormCommand(''); setFormArgs(''); setFormToken('') }
  }, [mode])

  const handleSave = async () => {
    if (!formName.trim()) return
    if (formType === 'http' && !formUrl.trim()) return
    if (formType === 'stdio' && !formCommand.trim()) return
    setSaving(true)
    try {
      const body: any = { name: formName.trim(), type: formType, token: formToken.trim() }
      if (formType === 'http') body.url = formUrl.trim()
      if (formType === 'stdio') {
        body.command = formCommand.trim()
        body.args = formArgs.trim() ? formArgs.trim().split(/\s+/) : []
      }
      const res = await authFetch('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setMode('list')
        setTimeout(fetchServers, 2000)
      }
    } catch {}
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await authFetch(`/api/mcp/servers/${id}`, { method: 'DELETE' })
    fetchServers()
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    setServers((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !enabled } : s))
    await authFetch(`/api/mcp/servers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    })
  }

  if (mode === 'add') {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>名称</label>
          <input
            placeholder="如: GitHub"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>类型</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setFormType('stdio')}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, background: formType === 'stdio' ? 'var(--accent)' : 'var(--bg-tertiary)', color: formType === 'stdio' ? '#fff' : 'var(--text-secondary)' }}
            >
              stdio (进程)
            </button>
            <button
              onClick={() => setFormType('http')}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, background: formType === 'http' ? 'var(--accent)' : 'var(--bg-tertiary)', color: formType === 'http' ? '#fff' : 'var(--text-secondary)' }}
            >
              HTTP
            </button>
          </div>
        </div>
        {formType === 'http' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>URL</label>
            <input
              placeholder="https://..."
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }}
            />
          </div>
        )}
        {formType === 'stdio' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>命令</label>
              <input
                placeholder="如: npx"
                value={formCommand}
                onChange={(e) => setFormCommand(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>参数 (空格分隔)</label>
              <input
                placeholder="如: -y @modelcontextprotocol/server-github"
                value={formArgs}
                onChange={(e) => setFormArgs(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }}
              />
            </div>
          </>
        )}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Token{formType === 'stdio' ? ' (env: GITHUB_PERSONAL_ACCESS_TOKEN 等)' : ''}
          </label>
          <input
            type="password"
            placeholder="Personal Access Token"
            value={formToken}
            onChange={(e) => setFormToken(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setMode('list')} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 12 }}>取消</button>
          <button onClick={handleSave} disabled={saving || !formName.trim()} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: saving ? 'var(--bg-tertiary)' : 'var(--accent)', color: saving ? 'var(--text-tertiary)' : '#fff', fontSize: 12 }}>{saving ? '添加中...' : '保存'}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
      {servers.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0', fontSize: 13 }}>
          暂无 MCP Server，点击"添加"接入
        </div>
      )}
      {servers.map((s) => (
        <div
          key={s.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            marginBottom: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.type === 'stdio' ? `${s.command} ${(s.args || []).join(' ')}` : s.url}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
            <button
              onClick={() => handleToggle(s.id, s.enabled)}
              title={s.enabled ? '禁用' : '启用'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                background: 'transparent',
                color: s.enabled ? 'var(--accent)' : 'var(--text-tertiary)',
                fontSize: 11,
                padding: '2px 4px',
              }}
            >
              {s.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              title="删除"
              style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4 }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function WebSearchPage() {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)
  const [embKey, setEmbKey] = useState('')
  const [embUrl, setEmbUrl] = useState('')
  const [embModel, setEmbModel] = useState('')
  const [embShowKey, setEmbShowKey] = useState(false)
  const [embSaved, setEmbSaved] = useState(false)
  const [embExists, setEmbExists] = useState(false)

  useEffect(() => {
    authFetch('/api/config').then(r => r.json()).then(c => {
      if (c.webSearch?.apiKey) {
        setHasExisting(true)
        setApiKey(c.webSearch.apiKey)
      }
      if (c.embedding?.apiKey) {
        setEmbExists(true)
        setEmbKey(c.embedding.apiKey)
      }
      if (c.embedding?.baseUrl) setEmbUrl(c.embedding.baseUrl)
      if (c.embedding?.model) setEmbModel(c.embedding.model)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    try {
      await authFetch('/api/config/websearch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }) })
      setSaved(true)
      setHasExisting(true)
      setTimeout(() => setSaved(false), 1500)
    } catch {}
  }

  const handleSaveEmb = async () => {
    try {
      await authFetch('/api/config/embedding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: embKey, baseUrl: embUrl, model: embModel }) })
      setEmbSaved(true)
      setEmbExists(true)
      setTimeout(() => setEmbSaved(false), 1500)
    } catch {}
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={14} /> 网页搜索 (Tavily)
          {hasExisting && <span style={{ fontSize: 11, color: 'var(--success-text)', fontWeight: 400 }}>已配置</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', padding: '0 10px' }}>
            <input type={showKey ? 'text' : 'password'} placeholder="Tavily API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              style={{ flex: 1, fontSize: 13, padding: '8px 0', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)' }} />
            <button onClick={() => setShowKey(!showKey)} title="显示/隐藏" style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 4 }}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: saved ? 'var(--success)' : 'var(--accent)', color: '#fff', flexShrink: 0 }}>
            {saved ? <Check size={16} /> : <Save size={16} />}
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border-color)', marginBottom: 24 }} />

        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BookOpen size={14} /> Embedding 模型
          {embExists && <span style={{ fontSize: 11, color: 'var(--success-text)', fontWeight: 400 }}>已配置</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          用于 RAG 知识库的文本向量化。推荐 Jina AI (免费): api.jina.ai
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="API Key" type={embShowKey ? 'text' : 'password'} value={embKey} onChange={(e) => setEmbKey(e.target.value)}
            style={{ flex: 2, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }} />
          <button onClick={() => setEmbShowKey(!embShowKey)} title="显示/隐藏" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', padding: '0 8px', fontSize: 12 }}>
            {embShowKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input placeholder="Base URL (如: https://api.jina.ai/v1)" value={embUrl} onChange={(e) => setEmbUrl(e.target.value)}
            style={{ flex: 2, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }} />
          <input placeholder="模型名 (如: jina-embeddings-v3)" value={embModel} onChange={(e) => setEmbModel(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }} />
        </div>
        <button onClick={handleSaveEmb} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', fontSize: 12 }}>
          {embSaved ? <Check size={14} /> : <Save size={14} />} 保存 Embedding 配置
        </button>
      </div>
    )
  }
