import { Search, Plus, Wrench, Clock, Trash2, X, Sparkles, Pin, BookOpen } from 'lucide-react'
import { useChatStore, useAppStore } from '../../store'
import { useState } from 'react'
import { PromptDialog } from '../common/PromptDialog'

export function ChatSidebar() {
  const { conversations, activeConversationId, searchQuery, setSearchQuery, createConversation, deleteConversation, setActiveConversation, togglePin } = useChatStore()
  const { leftSidebarOpen, setShowSkillsPanel, setShowCronPanel, setShowToolsPanel, setShowRagPanel } = useAppStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  if (!leftSidebarOpen) return null

  const filtered = conversations
    .filter((c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.createdAt - a.createdAt
    })

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
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}
    >
      {/* Search + New button */}
      <div style={{ padding: '12px', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Search size={14} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="搜索对话内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, fontSize: 13, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', minWidth: 0 }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              title="清除搜索"
              style={{
                display: 'flex',
                background: 'transparent',
                color: 'var(--text-tertiary)',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        {(() => {
          const activeConv = conversations.find((c) => c.id === activeConversationId)
          const activeIsEmpty = activeConv ? activeConv.messages.length === 0 : false
          const existingEmpty = conversations.find((c) => c.messages.length === 0)
          const canCreate = !activeIsEmpty
          const handleClick = () => {
            if (!canCreate) return
            if (existingEmpty) {
              setActiveConversation(existingEmpty.id)
            } else {
              createConversation()
            }
          }
          return (
        <button
          onClick={handleClick}
          title="新建对话"
          disabled={!canCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            background: canCreate ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: canCreate ? '#fff' : 'var(--text-tertiary)',
            fontSize: 13,
            fontWeight: 500,
            transition: 'var(--transition)',
            cursor: canCreate ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { if (canCreate) e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={(e) => { if (canCreate) e.currentTarget.style.background = 'var(--accent)' }}
        >
          <Plus size={15} strokeWidth={3.0} />
        </button>
          )
        })()}
      </div>

      {/* Skills & Cron nav */}
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => setShowSkillsPanel(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            transition: 'var(--transition)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Sparkles size={15} />
          Skills 仓库
        </button>
        <button
          onClick={() => setShowToolsPanel(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            transition: 'var(--transition)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Wrench size={15} />
          Tools 仓库
        </button>
        <button
          onClick={() => setShowRagPanel(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            borderRadius: 'var(--radius-sm)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: 13, transition: 'var(--transition)', textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <BookOpen size={15} /> RAG 知识库
        </button>
        <button
          onClick={() => setShowCronPanel(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            transition: 'var(--transition)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Clock size={15} />
          定时任务
        </button>
      </div>

      <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 12px', flexShrink: 0 }} />

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {filtered.map((conv, i) => (
          <>
            {/* Divider between pinned and unpinned */}
            {i > 0 && Boolean(conv.pinned) !== Boolean(filtered[i - 1].pinned) && (
              <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 4px', flexShrink: 0 }} />
            )}
          <div
            key={conv.id}
            onClick={() => setActiveConversation(conv.id)}
            onMouseEnter={() => setHoveredId(conv.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: conv.id === activeConversationId ? 'var(--bg-active)' : 'transparent',
              cursor: 'pointer',
              transition: 'var(--transition)',
              marginBottom: 2,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: conv.id === activeConversationId ? 'var(--text-primary)' : 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {conv.title}
            </span>
            {hoveredId === conv.id && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePin(conv.id)
                  }}
                  title={conv.pinned ? '取消置顶' : '置顶'}
                  style={{
                    display: 'flex',
                    background: 'transparent',
                    color: conv.pinned ? 'var(--accent)' : 'var(--text-tertiary)',
                    padding: 2,
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  <Pin size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget({ id: conv.id, title: conv.title })
                  }}
                  style={{
                    display: 'flex',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    padding: 2,
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
          </>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '24px 0' }}>
            {searchQuery ? '无匹配对话' : '暂无对话'}
          </div>
        )}
      </div>
    </aside>
    {deleteTarget && (
      <PromptDialog
        title={`确认删除 "${deleteTarget.title}" 对话？`}
        requireInput={false}
        confirmLabel="删除"
        onConfirm={() => {
          deleteConversation(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    )}
    </>
  )
}
