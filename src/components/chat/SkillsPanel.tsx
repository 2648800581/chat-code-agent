import { useState } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, X, Sparkles, PenLine } from 'lucide-react'
import { useSkillsStore } from '../../store'

export function SkillsPanel({ onClose }: { onClose: () => void }) {
  const { skills, addSkill, updateSkill, deleteSkill, toggleChatSkill, toggleCodeSkill } = useSkillsStore()
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formContent, setFormContent] = useState('')

  const openAdd = () => {
    setFormName('')
    setFormDesc('')
    setFormContent('')
    setEditingId(null)
    setMode('add')
  }

  const openEdit = (id: string) => {
    const sk = skills.find((s) => s.id === id)
    if (!sk) return
    setFormName(sk.name)
    setFormDesc(sk.description)
    setFormContent(sk.content)
    setEditingId(id)
    setMode('edit')
  }

  const handleSave = () => {
    if (!formName.trim() || !formDesc.trim() || !formContent.trim()) return
    if (mode === 'edit' && editingId) {
      updateSkill(editingId, { name: formName.trim(), description: formDesc.trim(), content: formContent.trim() })
    } else {
      addSkill({
        name: formName.trim(),
        description: formDesc.trim(),
        content: formContent.trim(),
        chatEnabled: true,
        codeEnabled: true,
      })
    }
    setMode('list')
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
          width: 520,
          maxHeight: '75vh',
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
            <Sparkles size={18} color="var(--text-primary)" />
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {mode === 'add' ? '新建 Skill' : mode === 'edit' ? '编辑 Skill' : 'Skills 仓库'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginRight: 8, alignItems: 'center' }}>
            {mode === 'list' && (
              <button
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
            <button
              onClick={onClose}
              title="关闭面板"
              style={{
                display: 'flex',
                background: 'transparent',
                color: 'var(--text-secondary)',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form (full page - replaces list) */}
        {mode !== 'list' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>名称</label>
              <input
                placeholder="Skill 名称"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>描述</label>
              <input
                placeholder="描述"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>内容 (Markdown)</label>
              <textarea
                placeholder="Skill 内容 (Markdown)"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={10}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMode('list')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                保存
              </button>
            </div>
          </div>
        )}

        {/* Skills list */}
        {mode === 'list' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
            {skills.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0', fontSize: 13 }}>
                暂无 Skill，点击"添加"创建
              </div>
            )}
            {skills.map((skill) => (
              <div
                key={skill.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  marginBottom: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{skill.name}</div>
                  {skill.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{skill.description}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {skill.content.slice(0, 80)}{skill.content.length > 80 ? '...' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                  <button
                    onClick={() => toggleChatSkill(skill.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      background: 'transparent',
                      color: skill.chatEnabled ? 'var(--accent)' : 'var(--text-tertiary)',
                      fontSize: 11,
                      padding: '2px 4px',
                      borderRadius: 4,
                      opacity: skill.chatEnabled ? 1 : 0.5,
                    }}
                  >
                    {skill.chatEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    聊天
                  </button>
                  <button
                    onClick={() => toggleCodeSkill(skill.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      background: 'transparent',
                      color: skill.codeEnabled ? 'var(--accent)' : 'var(--text-tertiary)',
                      fontSize: 11,
                      padding: '2px 4px',
                      borderRadius: 4,
                      opacity: skill.codeEnabled ? 1 : 0.5,
                    }}
                  >
                    {skill.codeEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    编程
                  </button>
                  <button
                    onClick={() => openEdit(skill.id)}
                    title="编辑"
                    style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4 }}
                  >
                    <PenLine size={14} />
                  </button>
                  <button
                    onClick={() => deleteSkill(skill.id)}
                    title="删除技能"
                    style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
