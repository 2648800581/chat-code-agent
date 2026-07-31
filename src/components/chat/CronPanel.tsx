import { useState, useEffect } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, X, Clock, Play, PenLine } from 'lucide-react'
import { useApiStore, useSkillsStore, useToolsStore } from '../../store'
import { CopyButton } from '../common/CopyButton'
import { MarkdownRenderer } from '../common/MarkdownRenderer'
import { authFetch } from '../../utils/auth'

interface CronJob {
  id: string
  name: string
  prompt: string
  schedule: string
  enabled: boolean
  model: string
  provider: string
  skillIds: string[]
  toolNames: string[]
  createdAt: string
}

interface CronResult {
  jobId: string
  jobName: string
  timestamp: string
  duration: number
  success: boolean
  content?: string
  error?: string
  triggered?: string
}

export function CronPanel({ onClose }: { onClose: () => void }) {
  const { providers, activeModel, activeProvider } = useApiStore()
  const { skills } = useSkillsStore()
  const { tools } = useToolsStore()
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [results, setResults] = useState<CronResult[]>([])
  const [tab, setTab] = useState<'jobs' | 'history'>('jobs')
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formPrompt, setFormPrompt] = useState('')
  const [formSchedule, setFormSchedule] = useState('')
  const [formProvider, setFormProvider] = useState(activeProvider)
  const [formModel, setFormModel] = useState(activeModel)
  const [formSkillIds, setFormSkillIds] = useState<string[]>([])
  const [formToolNames, setFormToolNames] = useState<string[]>([])
  const [expandedResult, setExpandedResult] = useState<number | null>(null)

  const configuredProviders = providers.filter((p) => p.configured)

  const fetchJobs = async () => {
    try {
      const res = await authFetch('/api/cron/jobs')
      if (res.ok) setJobs(await res.json())
    } catch {}
  }

  const fetchResults = async () => {
    try {
      const res = await authFetch('/api/cron/results')
      if (res.ok) setResults(await res.json())
    } catch {}
  }

  useEffect(() => {
    fetchJobs()
    fetchResults()
  }, [])

  const openAdd = () => {
    setFormName('')
    setFormPrompt('')
    setFormSchedule('')
    setFormProvider(activeProvider)
    setFormModel(activeModel)
    setFormSkillIds([])
    setFormToolNames([])
    setEditingId(null)
    setMode('add')
  }

  const openEdit = (job: CronJob) => {
    setFormName(job.name)
    setFormPrompt(job.prompt)
    setFormSchedule(job.schedule)
    setFormProvider(job.provider)
    setFormModel(job.model)
    setFormSkillIds(job.skillIds || [])
    setFormToolNames(job.toolNames || [])
    setEditingId(job.id)
    setMode('edit')
  }

  const handleSave = async () => {
    if (!formName.trim() || !formPrompt.trim() || !formSchedule.trim()) return
    if (mode === 'edit' && editingId) {
      try {
        await authFetch(`/api/cron/jobs/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            prompt: formPrompt.trim(),
            schedule: formSchedule.trim(),
            provider: formProvider,
            model: formModel,
            skillIds: formSkillIds,
            toolNames: formToolNames,
          }),
        })
        fetchJobs()
        setMode('list')
      } catch {}
    } else {
      try {
        const res = await authFetch('/api/cron/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            prompt: formPrompt.trim(),
            schedule: formSchedule.trim(),
            provider: formProvider,
            model: formModel,
            skillIds: formSkillIds,
            toolNames: formToolNames,
            enabled: true,
          }),
        })
        if (res.ok) {
          setMode('list')
          fetchJobs()
        }
      } catch {}
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, enabled: !enabled } : j)))
    try {
      await authFetch(`/api/cron/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, enabled } : j)))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await authFetch(`/api/cron/jobs/${id}`, { method: 'DELETE' })
      fetchJobs()
    } catch {}
  }

  const handleRunNow = async (id: string) => {
    try {
      await authFetch(`/api/cron/jobs/${id}/run`, { method: 'POST' })
      setTimeout(fetchResults, 3000)
    } catch {}
  }

  const handleDeleteResult = async (index: number) => {
    try {
      await authFetch(`/api/cron/results/${index}`, { method: 'DELETE' })
      fetchResults()
    } catch {}
  }

  const handleClearResults = async () => {
    try {
      await authFetch('/api/cron/results', { method: 'DELETE' })
      setResults([])
    } catch {}
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const toggleItem = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

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
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 580,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Clock size={18} color="var(--text-primary)" />
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {mode === 'add' ? '新建定时任务' : mode === 'edit' ? '编辑定时任务' : '定时任务'}
            </span>
            {mode === 'list' && (
              <div style={{ display: 'flex', gap: 2, marginLeft: 12 }}>
                <button
                  type="button"
                  onClick={() => setTab('jobs')}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    background: tab === 'jobs' ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: tab === 'jobs' ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  任务列表
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('history'); fetchResults() }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    background: tab === 'history' ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: tab === 'history' ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  执行历史
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginRight: 8, alignItems: 'center' }}>
            {mode === 'list' && tab === 'jobs' && (
              <button
                type="button"
                onClick={openAdd}
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
            {mode === 'list' && tab === 'history' && results.length > 0 && (
              <button
                type="button"
                onClick={handleClearResults}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                <Trash2 size={14} /> 清空历史
              </button>
            )}
            <button
              type="button"
              title="关闭面板"
              onClick={onClose}
              style={{ display: 'flex', background: 'transparent', color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form (full page) */}
        {mode !== 'list' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>任务名称</label>
              <input
                placeholder="任务名称"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Cron 表达式 (如: 0 9 * * * 表示每天9点)</label>
              <input
                placeholder="Cron 表达式"
                value={formSchedule}
                onChange={(e) => setFormSchedule(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <select
                value={formProvider}
                onChange={(e) => {
                  setFormProvider(e.target.value)
                  const p = providers.find((pr) => pr.id === e.target.value)
                  if (p?.models[0]) setFormModel(p.models[0])
                }}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 12, color: 'var(--text-primary)' }}
              >
                {configuredProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 12, color: 'var(--text-primary)' }}
              >
                {(providers.find((p) => p.id === formProvider)?.models || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Prompt 内容</label>
              <textarea
                placeholder="执行的 Prompt 内容"
                value={formPrompt}
                onChange={(e) => setFormPrompt(e.target.value)}
                rows={5}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', fontSize: 13, color: 'var(--text-primary)', resize: 'vertical' }}
              />
            </div>
            {skills.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>注入 Skills：</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {skills.map((sk) => (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => toggleItem(formSkillIds, setFormSkillIds, sk.id)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        background: formSkillIds.includes(sk.id) ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: formSkillIds.includes(sk.id) ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {sk.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tools.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>注入 Tools：</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {tools.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleItem(formToolNames, setFormToolNames, t.name)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        background: formToolNames.includes(t.name) ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: formToolNames.includes(t.name) ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setMode('list')} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 12 }}>取消</button>
              <button type="button" onClick={handleSave} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', fontSize: 12 }}>保存</button>
            </div>
          </div>
        )}

        {/* Content */}
        {mode === 'list' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
            {tab === 'jobs' ? (
              jobs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0', fontSize: 13 }}>暂无定时任务，点击"添加"创建</div>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      marginBottom: 8,
                      opacity: job.enabled ? 1 : 0.5,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{job.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '1px 6px', background: 'var(--bg-tertiary)', borderRadius: 3 }}>{job.schedule}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{job.provider}/{job.model}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {job.prompt.slice(0, 80)}{job.prompt.length > 80 ? '...' : ''}
                      </div>
                      {((job.skillIds && job.skillIds.length > 0) || (job.toolNames && job.toolNames.length > 0)) && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {job.skillIds?.map((id) => {
                            const sk = skills.find((s) => s.id === id)
                            return sk ? <span key={id} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)' }}>skill:{sk.name}</span> : null
                          })}
                          {job.toolNames?.map((name) => (
                            <span key={name} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)' }}>tool:{name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <button type="button" onClick={() => handleRunNow(job.id)} style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4 }} title="立即执行">
                        <Play size={14} />
                      </button>
                      <button type="button" onClick={(e) => { e.preventDefault(); handleToggle(job.id, job.enabled) }} title="启停任务" style={{ display: 'flex', background: 'transparent', color: job.enabled ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                        {job.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button type="button" onClick={() => openEdit(job)} title="编辑" style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4 }}>
                        <PenLine size={14} />
                      </button>
                      <button type="button" onClick={() => handleDelete(job.id)} title="删除任务" style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              results.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0', fontSize: 13 }}>暂无执行记录</div>
              ) : (
                results.map((r, i) => (
                  <div
                    key={i}
                    className="copy-btn-parent"
                    style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: 6, cursor: 'pointer' }}
                    onClick={() => setExpandedResult(expandedResult === i ? null : i)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{r.jobName}</span>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: r.success ? 'var(--success-bg)' : 'var(--error-bg)', color: r.success ? 'var(--success-text)' : 'var(--error-text)' }}>{r.success ? '成功' : '失败'}</span>
                        {r.triggered === 'manual' && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>手动</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.success && r.content && (
                          <CopyButton content={r.content} size={12} />
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatTime(r.timestamp)}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteResult(i) }} style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 2, borderRadius: 3 }} title="删除此记录">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    {expandedResult === i && (
                      <div style={{ marginTop: 8 }}>
                        <MarkdownRenderer content={r.success ? r.content || '' : r.error || ''} />
                      </div>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
