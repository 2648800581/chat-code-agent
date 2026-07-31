import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, ChevronDown, ChevronRight, Paperclip, X, FileText, Loader2, Plus, Trash2, PanelRightClose, Search } from 'lucide-react'
import { useCodeStore, useApiStore, useAppStore, useSkillsStore, useToolsStore } from '../../store'
import { CopyButton } from '../common/CopyButton'
import { MarkdownRenderer } from '../common/MarkdownRenderer'
import { PromptDialog } from '../common/PromptDialog'
import { authFetch } from '../../utils/auth'
import { v4 as uuidv4 } from 'uuid'
import { formatTokenCount } from '../../utils/api'
import type { CodeMessage } from '../../types'

export function CodeAIChat() {
  const { codeConversations, activeCodeConversationId, createCodeConversation, deleteCodeConversation, setActiveCodeConversation, addCodeMessage, updateCodeMessage, getActiveCodeConversation, selectedFiles, toggleSelectedFile, clearSelectedFiles, fileTree, openFiles, projectPath, addToolCall, setFileTree, setFileContent, codeActiveProvider, codeActiveModel, setCodeProvider, setCodeModel } = useCodeStore()
  const { providers, getContextWindow } = useApiStore()
  const { skills } = useSkillsStore()
  const { tools } = useToolsStore()
  const { rightPanelOpen } = useAppStore()
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [thinkingOpen, setThinkingOpen] = useState<Record<string, boolean>>({})
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [convDropdownOpen, setConvDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeConv = getActiveCodeConversation()
  const messages = activeConv?.messages || []

  // Auto-create conversation if none exists for this project
  useEffect(() => {
    if (!projectPath) return // no project open, skip
    if (!activeCodeConversationId || !activeConv || activeConv.projectPath !== projectPath) {
      const projectConvs = codeConversations.filter((c) => c.projectPath === projectPath)
      if (projectConvs.length > 0) {
        setActiveCodeConversation(projectConvs[0].id)
      } else {
        createCodeConversation()
      }
    }
  }, [projectPath, activeCodeConversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea: grow up to 8 lines, shrink back when empty
  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 18.2 // 13px * 1.4
    const maxHeight = lineHeight * 8
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
  }, [])

  useEffect(() => {
    autoResize()
  }, [input, autoResize])

  // Collect all files from tree for file picker
  const allFiles: { path: string; name: string }[] = []
  const collectFiles = (nodes: typeof fileTree) => {
    for (const n of nodes) {
      if (n.type === 'file') allFiles.push({ path: n.path, name: n.name })
      if (n.children) collectFiles(n.children)
    }
  }
  collectFiles(fileTree)

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return

    const userInput = input.trim()
    const provider = providers.find((p) => p.id === codeActiveProvider)
    if (!provider?.configured) return

    // Snapshot history BEFORE adding new messages (store update is synchronous)
    const prevMsgs = messages.map((m) => ({ role: m.role, content: m.content }))

    const userMsg: CodeMessage = {
      id: uuidv4(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
      referencedFiles: selectedFiles.length > 0 ? [...selectedFiles] : undefined,
    }
    setInput('')
    const curSelectedFiles = [...selectedFiles]
    clearSelectedFiles()

    const assistantMsg: CodeMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      thinking: '',
      timestamp: Date.now(),
      model: codeActiveModel,
    }

    addCodeMessage(userMsg)
    addCodeMessage(assistantMsg)
    setIsStreaming(true)

    // Generate AI title for first user message (programming mode)
    if (activeConv && activeConv.messages.length === 0 && provider?.configured) {
      authFetch('/api/chat/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: codeActiveModel,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          message: userInput,
        }),
      }).then(res => res.json()).then(data => {
        if (data.title) {
          useCodeStore.getState().updateTitle(activeCodeConversationId, data.title)
        }
      }).catch(() => {})
    }

    // Build API messages (prevMsgs captured before addCodeMessage)
    const allMsgs = [...prevMsgs, { role: userMsg.role, content: userMsg.content }]

    try {
      const res = await authFetch('/api/code/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: codeActiveProvider,
          model: codeActiveModel,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          projectPath,
          selectedFiles: curSelectedFiles.length > 0 ? curSelectedFiles : undefined,
          enabledSkills: skills.filter((s) => s.codeEnabled).map((s) => ({ name: s.name, description: s.description, content: s.content })),
          enabledTools: tools.filter((t) => t.codeEnabled).map((t) => t.name),
          messages: allMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        updateCodeMessage(assistantMsg.id, { content: `Error: ${err}` })
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setIsStreaming(false); return }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(trimmed.slice(6))
            if (parsed.type === 'tool_calls') {
              for (const tc of parsed.calls) {
                addToolCall({ name: tc.name, args: tc.args, result: tc.result, status: 'completed' })
                // 写入或删除文件后刷新文件树
                if (tc.name === 'write_file' || tc.name === 'delete_file') {
                  const store = useCodeStore.getState()
                  if (store.projectPath) {
                    authFetch('/api/files/tree', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ path: store.projectPath }),
                    }).then(res => res.json()).then(tree => {
                      setFileTree(tree)
                    }).catch(() => {})
                    // 如果是 write_file，同时刷新已打开的文件内容
                    if (tc.name === 'write_file' && tc.args.path && store.fileContents[tc.args.path] !== undefined) {
                      authFetch('/api/files/content', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: tc.args.path }),
                      }).then(res => res.json()).then(data => {
                        setFileContent(tc.args.path, data.content)
                      }).catch(() => {})
                    }
                  }
                }
              }
            } else if (parsed.type === 'content') {
              const conv = useCodeStore.getState().getActiveCodeConversation()
              const currentMsgs = conv?.messages || []
              const existing = currentMsgs.find(m => m.id === assistantMsg.id)
              updateCodeMessage(assistantMsg.id, { content: (existing?.content || '') + parsed.content })
            } else if (parsed.type === 'thinking') {
              const conv = useCodeStore.getState().getActiveCodeConversation()
              const currentMsgs = conv?.messages || []
              const existing = currentMsgs.find(m => m.id === assistantMsg.id)
              updateCodeMessage(assistantMsg.id, { thinking: (existing?.thinking || '') + parsed.content })
            } else if (parsed.type === 'done') {
              if (parsed.usage) {
                updateCodeMessage(assistantMsg.id, {
                  tokenUsage: {
                    promptTokens: parsed.usage.prompt_tokens || 0,
                    completionTokens: parsed.usage.completion_tokens || 0,
                    totalTokens: parsed.usage.total_tokens || 0,
                    contextWindow: getContextWindow(codeActiveProvider, codeActiveModel),
                  },
                })
              }
            }
          } catch {}
        }
      }
    } catch (err) {
      updateCodeMessage(assistantMsg.id, { content: `Error: ${err}` })
    }

    setIsStreaming(false)
  }, [input, isStreaming, providers, codeActiveProvider, codeActiveModel, messages, selectedFiles, addCodeMessage, updateCodeMessage, clearSelectedFiles, projectPath, addToolCall, getContextWindow, tools, skills])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!rightPanelOpen) return null

  const totalTokens = messages.reduce((acc, m) => acc + (m.tokenUsage?.totalTokens || 0), 0)
  const contextWindow = getContextWindow(codeActiveProvider, codeActiveModel)

  return (
    <>
    <aside
      style={{
        width: 320,
        minWidth: 320,
        height: '100%',
        borderLeft: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header with conversation management + collapse */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}
      >
        {/* Collapse button */}
        <button
          type="button"
          onClick={() => useAppStore.getState().toggleRightPanel()}
          title="关闭右侧栏"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 4,
            background: 'transparent',
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
        >
          <PanelRightClose size={18} />
        </button>
        {/* Conversation selector */}
        {(() => {
          const projectConvs = codeConversations.filter((c) => c.projectPath === projectPath)
          const filteredConvs = projectConvs.filter((c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
          )
          return (
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => { setConvDropdownOpen(!convDropdownOpen); setSearchQuery('') }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  overflow: 'hidden',
                  gap: 4,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(activeConv?.title || '新对话').length > 25 ? (activeConv?.title || '新对话').slice(0, 25) + '...' : (activeConv?.title || '新对话')}
                </span>
                <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
              </button>
              {convDropdownOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => { setConvDropdownOpen(false); setSearchQuery('') }} />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 100,
                    maxHeight: 280,
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 8px',
                      borderBottom: '1px solid var(--border-color)',
                      flexShrink: 0,
                    }}>
                      <Search size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
                      <input
                        type="text"
                        placeholder="搜索对话内容..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        style={{ flex: 1, fontSize: 11, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', minWidth: 0 }}
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} title="清除搜索" style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)' }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {filteredConvs.map((c) => {
                        const shortTitle = c.title.length > 25 ? c.title.slice(0, 25) + '...' : c.title
                        const isActive = c.id === activeCodeConversationId
                        return (
                          <div
                            key={c.id}
                            onClick={() => { setActiveCodeConversation(c.id); setConvDropdownOpen(false); setSearchQuery('') }}
                            style={{
                              padding: '6px 10px',
                              fontSize: 12,
                              cursor: 'pointer',
                              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                              background: isActive ? 'var(--accent-light)' : 'transparent',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                          >
                            {shortTitle}
                          </div>
                        )
                      })}
                      {filteredConvs.length === 0 && (
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {searchQuery ? '无匹配对话' : '暂无对话'}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })()}
        <button
          type="button"
          onClick={() => {
            if (!activeConv || activeConv.messages.length === 0) return
            const projectConvs = codeConversations.filter((c) => c.projectPath === projectPath)
            const existingEmpty = projectConvs.find((c) => c.messages.length === 0)
            if (existingEmpty) {
              setActiveCodeConversation(existingEmpty.id)
            } else {
              createCodeConversation()
            }
          }}
          disabled={!activeConv || activeConv.messages.length === 0}
          title="新建对话"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            background: activeConv && activeConv.messages.length > 0 ? 'var(--bg-tertiary)' : 'var(--bg-hover)',
            color: activeConv && activeConv.messages.length > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            flexShrink: 0,
            cursor: activeConv && activeConv.messages.length > 0 ? 'pointer' : 'not-allowed',
            opacity: activeConv && activeConv.messages.length > 0 ? 1 : 0.5,
          }}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (activeCodeConversationId && codeConversations.filter((c) => c.projectPath === projectPath).length > 1) {
              const conv = codeConversations.find(c => c.id === activeCodeConversationId)
              if (conv) setDeleteTarget({ id: activeCodeConversationId, title: conv.title })
            }
          }}
          title="删除当前对话"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'var(--bg-tertiary)',
            color: codeConversations.filter((c) => c.projectPath === projectPath).length > 1
              ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            flexShrink: 0,
            opacity: codeConversations.filter((c) => c.projectPath === projectPath).length > 1 ? 1 : 0.5,
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {!projectPath ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, padding: '32px 0' }}>
            请先打开项目文件夹
          </div>
        ) : messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, padding: '32px 0' }}>
            AI 将读取项目上下文来回答问题
          </div>
        )}
        {messages.map((msg) => (
          <div
            className="copy-btn-parent"
            key={msg.id}
            style={{
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {/* Referenced files */}
            {msg.referencedFiles && msg.referencedFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4, justifyContent: 'flex-end' }}>
                {msg.referencedFiles.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {f.split('/').pop()}
                  </span>
                ))}
              </div>
            )}

            {/* Thinking */}
            {msg.thinking && msg.thinking.length > 0 && (
              <div style={{ width: '100%', marginBottom: 4 }}>
                <button
                  onClick={() => setThinkingOpen((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    fontSize: 11,
                    padding: '2px 0',
                  }}
                >
                  {thinkingOpen[msg.id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  思考
                </button>
                {thinkingOpen[msg.id] && (
                  <div
                    style={{
                      background: 'var(--thinking-bg)',
                      border: '1px solid var(--thinking-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.thinking}
                  </div>
                )}
              </div>
            )}

            <div className="copy-btn-parent" style={{ position: 'relative', display: 'inline-block', maxWidth: '90%' }}>
              <div
                className={msg.role === 'user' ? 'user-msg-bubble' : ''}
                style={{
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user'
                    ? 'var(--radius-sm) var(--radius-sm) 4px var(--radius-sm)'
                    : 'var(--radius-sm) var(--radius-sm) var(--radius-sm) 4px',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>思考中...</span>
                )}
              </div>
              {msg.content && <CopyButton content={msg.content} size={12} position={{ right: 0, bottom: -16 }} />}
            </div>

            {/* Model & token info */}
            {msg.role === 'assistant' && msg.model && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, padding: '0 4px' }}>
                {msg.model}
                {msg.tokenUsage && ` · ${formatTokenCount(msg.tokenUsage.totalTokens)} tokens`}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Token info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '0 16px 4px',
          fontSize: 10,
          color: 'var(--text-tertiary)',
        }}
      >
        {formatTokenCount(totalTokens)} / {formatTokenCount(contextWindow)}
      </div>

      {/* Model selector bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 12px 4px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 6,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 500,
              transition: 'var(--transition)',
            }}
          >
            {codeActiveModel}
            <ChevronDown size={12} />
          </button>

          {modelSelectorOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 4,
                width: 220,
                maxHeight: 300,
                overflowY: 'auto',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
              }}
            >
              {providers.map((p) => (
                <div key={p.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: p.configured ? '8px 12px 4px' : '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: p.configured ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    <img
                      src={p.icon}
                      alt={p.name}
                      style={{ width: 16, height: 16, borderRadius: 3 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    {p.name}
                    {!p.configured && (
                      <span style={{ fontSize: 10, marginLeft: 'auto', opacity: 0.5 }}>未接入</span>
                    )}
                  </div>
                  {p.configured && p.models.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setCodeProvider(p.id)
                        setCodeModel(m)
                        setModelSelectorOpen(false)
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '5px 12px 5px 36px',
                        fontSize: 12,
                        color: m === codeActiveModel && p.id === codeActiveProvider ? 'var(--accent)' : 'var(--text-secondary)',
                        background: m === codeActiveModel && p.id === codeActiveProvider ? 'var(--accent-light)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = m === codeActiveModel && p.id === codeActiveProvider ? 'var(--accent-light)' : 'transparent')}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
        {/* Selected files */}
        {selectedFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {selectedFiles.map((f) => (
              <div
                key={f}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '2px 6px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 4,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                }}
              >
                <FileText size={10} />
                {f.split('/').pop()}
                <button
                  onClick={() => toggleSelectedFile(f)}
                  title="移除文件"
                  style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 0 }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 6,
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            padding: '6px 10px',
          }}
        >
          {/* File picker */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setFilePickerOpen(!filePickerOpen)}
              title="选择文件"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--text-secondary)',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Paperclip size={14} />
            </button>

            {filePickerOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: 4,
                  width: 240,
                  maxHeight: 260,
                  overflowY: 'auto',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 100,
                  padding: 6,
                }}
              >
                {allFiles.length === 0 && openFiles.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    无可用文件
                  </div>
                ) : (
                  (allFiles.length > 0 ? allFiles : openFiles.map((f) => ({ path: f, name: f.split('/').pop() || f }))).map((f) => (
                    <button
                      key={f.path}
                      onClick={() => {
                        toggleSelectedFile(f.path)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        textAlign: 'left',
                        padding: '5px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        color: selectedFiles.includes(f.path) ? 'var(--accent)' : 'var(--text-secondary)',
                        background: selectedFiles.includes(f.path) ? 'var(--accent-light)' : 'transparent',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = selectedFiles.includes(f.path) ? 'var(--accent-light)' : 'transparent')}
                    >
                      <FileText size={12} />
                      {f.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={projectPath ? '询问 AI...' : '请先打开项目文件夹'}
            disabled={!projectPath}
            rows={1}
            style={{
              flex: 1,
              minWidth: 0,
              resize: 'none',
              fontSize: 13,
              lineHeight: 1.4,
              minHeight: 18.2,
              padding: '3px 0',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              overflowY: 'auto',
              opacity: projectPath ? 1 : 0.5,
            }}
          />

          <button
            type="button"
            title="发送消息"
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: projectPath && input.trim() && !isStreaming ? 'var(--accent)' : 'var(--bg-hover)',
              color: projectPath && input.trim() && !isStreaming ? '#fff' : 'var(--text-tertiary)',
              flexShrink: 0,
              transition: 'var(--transition)',
            }}
          >
            {isStreaming ? <Loader2 size={14} /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </aside>
    {deleteTarget && (
      <PromptDialog
        title={`确认删除 "${deleteTarget.title}" 对话？`}
        requireInput={false}
        confirmLabel="删除"
        onConfirm={() => {
          deleteCodeConversation(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    )}
    </>
  )
}