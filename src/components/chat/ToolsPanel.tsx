import { useEffect, useState } from 'react'
import { ToggleLeft, ToggleRight, X, Wrench } from 'lucide-react'
import { useToolsStore } from '../../store'
import { authFetch } from '../../utils/auth'
import type { Tool } from '../../types'

export function ToolsPanel({ onClose }: { onClose: () => void }) {
  const { tools, setTools, toggleChatTool, toggleCodeTool } = useToolsStore()
  const [tab, setTab] = useState<'built-in' | 'mcp'>('built-in')

  useEffect(() => {
    authFetch('/api/tools')
      .then((res) => res.json())
      .then((list: { name: string; description: string; source: string }[]) => {
        const existing = useToolsStore.getState().tools
        const merged: Tool[] = list.map((t) => {
          const prev = existing.find((e) => e.name === t.name)
          return {
            id: t.name,
            name: t.name,
            description: t.description,
            source: t.source,
            chatEnabled: prev?.chatEnabled ?? true,
            codeEnabled: prev?.codeEnabled ?? true,
            createdAt: prev?.createdAt ?? Date.now(),
          }
        })
        setTools(merged)
      })
      .catch(() => {})
  }, [setTools])

  const builtIn = tools.filter((t) => t.source !== 'mcp')
  const mcp = tools.filter((t) => t.source === 'mcp')
  const current = tab === 'built-in' ? builtIn : mcp

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
          width: 560,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Wrench size={18} color="var(--text-primary)" />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Tools 仓库</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => setTab('built-in')}
                style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  background: tab === 'built-in' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: tab === 'built-in' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                内置工具
              </button>
              <button
                onClick={() => setTab('mcp')}
                style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  background: tab === 'mcp' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: tab === 'mcp' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                MCP 工具
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            title="关闭面板"
            style={{ display: 'flex', background: 'transparent', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tools list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {current.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0', fontSize: 13 }}>
              {tab === 'mcp' ? '暂无 MCP 工具，请在设置接入 MCP Server' : '暂无内置工具'}
            </div>
          )}
          {current.map((tool) => (
            <div
              key={tool.id}
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
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{tool.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tool.description}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                <button
                  onClick={() => toggleChatTool(tool.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    background: 'transparent',
                    color: tool.chatEnabled ? 'var(--accent)' : 'var(--text-tertiary)',
                    fontSize: 11,
                    padding: '2px 4px',
                    borderRadius: 4,
                    opacity: tool.chatEnabled ? 1 : 0.5,
                  }}
                >
                  {tool.chatEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  聊天
                </button>
                <button
                  onClick={() => toggleCodeTool(tool.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    background: 'transparent',
                    color: tool.codeEnabled ? 'var(--accent)' : 'var(--text-tertiary)',
                    fontSize: 11,
                    padding: '2px 4px',
                    borderRadius: 4,
                    opacity: tool.codeEnabled ? 1 : 0.5,
                  }}
                >
                  {tool.codeEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  编程
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
