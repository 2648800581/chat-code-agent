import { useState } from 'react'
import { useAppStore, useChatStore, useCodeStore } from '../../store'
import { Sun, Moon, PanelLeftClose, PanelLeftOpen, Code, MessageSquare, Settings, Download, FileText, Braces } from 'lucide-react'
import { exportAsMarkdown, exportAsJSON, triggerDownload } from '../../utils/export'

export function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { theme, toggleTheme, mode, setMode, leftSidebarOpen, toggleLeftSidebar } = useAppStore()
  const { conversations, activeConversationId } = useChatStore()
  const { codeConversations, activeCodeConversationId } = useCodeStore()
  const [showExportMenu, setShowExportMenu] = useState(false)

  // 根据模式选择导出的对话数据
  const exportConv = mode === 'code'
    ? codeConversations.find(c => c.id === activeCodeConversationId)
    : conversations.find(c => c.id === activeConversationId)
  const exportMessages = exportConv && 'messages' in exportConv ? exportConv.messages : []
  const canExport = exportConv && exportMessages.length > 0

  const handleExport = (format: 'md' | 'json') => {
    if (!exportConv) return
    setShowExportMenu(false)
    const safeTitle = exportConv.title.replace(/[/\\:*?"<>|]/g, '_')
    if (format === 'json') {
      triggerDownload(exportAsJSON(exportConv.title, exportMessages), `${safeTitle}.json`)
    } else {
      triggerDownload(exportAsMarkdown(exportConv.title, exportMessages), `${safeTitle}.md`)
    }
  }

  return (
    <header
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={toggleLeftSidebar}
          title={leftSidebarOpen ? '关闭左侧栏' : '打开左侧栏'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            transition: 'var(--transition)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {leftSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>

        <div
          style={{
            display: 'flex',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            padding: 2,
          }}
        >
          <button
            onClick={() => setMode('chat')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: mode === 'chat' ? 600 : 400,
              background: mode === 'chat' ? 'var(--bg-primary)' : 'transparent',
              color: mode === 'chat' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: mode === 'chat' ? 'var(--shadow-sm)' : 'none',
              transition: 'var(--transition)',
            }}
          >
            <MessageSquare size={14} />
            聊天
          </button>
          <button
            onClick={() => setMode('code')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: mode === 'code' ? 600 : 400,
              background: mode === 'code' ? 'var(--bg-primary)' : 'transparent',
              color: mode === 'code' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: mode === 'code' ? 'var(--shadow-sm)' : 'none',
              transition: 'var(--transition)',
            }}
          >
            <Code size={14} />
            编程
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Export button */}
        {canExport && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="导出对话"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Download size={16} />
            </button>
            {showExportMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 36,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 100,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => handleExport('md')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: 120,
                    padding: '8px 14px',
                    fontSize: 12,
                    textAlign: 'left',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <FileText size={14} style={{ marginRight: 6 }} />Markdown
                </button>
                <button
                  onClick={() => handleExport('json')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: 120,
                    padding: '8px 14px',
                    fontSize: 12,
                    textAlign: 'left',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Braces size={14} style={{ marginRight: 6 }} />JSON
                </button>
              </div>
            )}
          </div>
        )}
        <button
          onClick={toggleTheme}
          title="切换主题"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            transition: 'var(--transition)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={onOpenSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            transition: 'var(--transition)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="设置"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}
