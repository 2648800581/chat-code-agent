import { useState, useRef, useEffect, useCallback } from 'react'
import { Paperclip, Send, ChevronDown, ChevronRight, Image, FileText, X, Loader2, PenLine } from 'lucide-react'

function ImagePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setUrl(reader.result as string)
    reader.readAsDataURL(file)
  }, [file])
  if (!url) return <Image size={12} />
  return (
    <img
      src={url}
      alt={file.name}
      style={{ width: 24, height: 24, borderRadius: 3, objectFit: 'cover' }}
    />
  )
}
import { CopyButton } from '../common/CopyButton'
import { MarkdownRenderer } from '../common/MarkdownRenderer'
import { useChatStore, useApiStore, useSkillsStore, useToolsStore } from '../../store'
import { authFetch } from '../../utils/auth'
import { v4 as uuidv4 } from 'uuid'
import { streamChat, formatTokenCount } from '../../utils/api'
import { readAttachedFiles, buildApiMessages } from '../../utils/files'
import type { Message, TokenUsage } from '../../types'

export function ChatWindow() {
  const { activeConversationId, conversations, addMessage, updateMessage } = useChatStore()
  const { providers, activeProvider, activeModel, setProvider, setModel, getContextWindow } = useApiStore()
  const { skills } = useSkillsStore()
  const { tools } = useToolsStore()
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [thinkingOpen, setThinkingOpen] = useState<Record<string, boolean>>({})
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [toolCallsOpen, setToolCallsOpen] = useState<Record<string, boolean>>({})
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const conversation = conversations.find((c) => c.id === activeConversationId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  // Auto-resize textarea: grow up to 8 lines, shrink back when empty
  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 21 // 14px * 1.5
    const maxHeight = lineHeight * 8
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
  }, [])

  useEffect(() => {
    autoResize()
  }, [input, autoResize])

  const handleSend = useCallback(async (editedInput?: string, skipTitleGen?: boolean) => {
    const userInput = (editedInput ?? input).trim()
    if (!userInput || !activeConversationId || isStreaming) return

    const currentProvider = providers.find((p) => p.id === activeProvider)
    if (!currentProvider?.configured) return

    const currentFiles = [...attachedFiles]
    setInput('')
    setAttachedFiles([])

    // Snapshot history BEFORE adding new messages (read from store for fresh state)
    const latestConv = useChatStore.getState().conversations.find((c) => c.id === activeConversationId)
    const prevMessages = (latestConv?.messages || []).map((m) => ({ role: m.role, content: m.content }))

    // Read file contents
    const fileData = currentFiles.length > 0 ? await readAttachedFiles(currentFiles) : []

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
      attachedFiles: fileData.length > 0 ? fileData.map((f) => ({
        name: f.name,
        type: f.type,
        dataUrl: f.type.startsWith('image/') ? f.content : undefined,
      })) : undefined,
    }

    const assistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      thinking: '',
      timestamp: Date.now(),
      model: activeModel,
    }

    addMessage(activeConversationId, userMsg)
    addMessage(activeConversationId, assistantMsg)
    setIsStreaming(true)

    // Generate AI title for first user message (skip when editing non-first messages)
    if (!skipTitleGen && latestConv && latestConv.messages.length === 0 && currentProvider?.configured) {
      authFetch('/api/chat/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel,
          apiKey: currentProvider.apiKey,
          baseUrl: currentProvider.baseUrl,
          message: userInput,
        }),
      }).then(res => res.json()).then(data => {
        if (data.title) {
          useChatStore.getState().updateTitle(activeConversationId, data.title)
        }
      }).catch(() => {})
    }

    const ctxWindow = getContextWindow(activeProvider, activeModel)

    // Build API messages with file contents (prevMessages captured before addMessage)
    const apiMessages = buildApiMessages(userInput, fileData, prevMessages)

    // Build system message with identity + matched skills
    const enabledSkills = skills.filter((s) => s.chatEnabled)
    const providerName = currentProvider?.name || activeProvider
    let sysMsg = `你是由 ${providerName} 提供的 ${activeModel} 模型。`

    if (enabledSkills.length > 0) {
      const list = enabledSkills.map(s => `${s.name} - ${s.description}`).join(', ')
      sysMsg += `\n\n可用 Skills: ${list}`
      sysMsg += '\n若用户意图与某个 Skill 相关，务必先调用 load_skill 工具获取完整指令再回答；否则忽略。'
    }

    // Build enabled tools list
    const enabledToolNames = tools.filter((t) => t.chatEnabled).map((t) => t.name)

    await streamChat(
      currentProvider,
      activeModel,
      currentProvider.apiKey,
      apiMessages,
      {
        onToken: (token) => {
          const currentConv = useChatStore.getState().conversations.find(c => c.id === activeConversationId)
          const existing = currentConv?.messages.find(m => m.id === assistantMsg.id)
          updateMessage(activeConversationId, assistantMsg.id, {
            content: (existing?.content || '') + token,
          })
        },
        onThinking: (token) => {
          const currentConv = useChatStore.getState().conversations.find(c => c.id === activeConversationId)
          const existing = currentConv?.messages.find(m => m.id === assistantMsg.id)
          updateMessage(activeConversationId, assistantMsg.id, {
            thinking: (existing?.thinking || '') + token,
          })
        },
        onToolCalls: (calls) => {
          updateMessage(activeConversationId, assistantMsg.id, { toolCalls: calls })
        },
        onDone: (usage?: TokenUsage) => {
          if (usage) {
            updateMessage(activeConversationId, assistantMsg.id, { tokenUsage: usage })
          }
          setIsStreaming(false)
        },
        onError: (error) => {
          updateMessage(activeConversationId, assistantMsg.id, {
            content: `Error: ${error}`,
          })
          setIsStreaming(false)
        },
      },
      ctxWindow,
      sysMsg,
      enabledToolNames
    )
  }, [input, activeConversationId, isStreaming, providers, activeProvider, activeModel, addMessage, updateMessage, tools])

  const handleEditSend = useCallback((msgId: string) => {
    if (!editText.trim() || isStreaming || !activeConversationId) return
    const conv = useChatStore.getState().conversations.find(c => c.id === activeConversationId)
    const isFirstMessage = conv?.messages[0]?.id === msgId
    useChatStore.getState().truncateMessages(activeConversationId, msgId)
    setEditingMessageId(null)
    handleSend(editText, !isFirstMessage)
  }, [editText, activeConversationId, isStreaming, handleSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileAttach = () => {
    inputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setAttachedFiles((prev) => [...prev, ...Array.from(files)])
    }
  }

  // Calculate token usage from all messages
  const totalTokens = conversation?.messages.reduce((acc, m) => {
    if (m.tokenUsage) return acc + m.tokenUsage.totalTokens
    return acc
  }, 0) || 0

  const contextWindow = getContextWindow(activeProvider, activeModel)

  if (!activeConversationId || !conversation) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: 'var(--text-tertiary)',
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.3 }}>⬡</div>
        <div style={{ fontSize: 15 }}>选择或创建一个对话</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {/* Thinking block */}
            {msg.thinking && msg.thinking.length > 0 && (
              <div
                style={{
                  width: '100%',
                  maxWidth: 720,
                  marginBottom: 6,
                }}
              >
                <button
                  onClick={() => setThinkingOpen((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    fontSize: 12,
                    padding: '4px 0',
                  }}
                >
                  {thinkingOpen[msg.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  思考过程
                </button>
                {thinkingOpen[msg.id] && (
                  <div
                    style={{
                      background: 'var(--thinking-bg)',
                      border: '1px solid var(--thinking-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.thinking}
                  </div>
                )}
              </div>
            )}

            {/* Tool calls */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div style={{ width: '100%', maxWidth: 720, marginBottom: 6 }}>
                <button
                  onClick={() => setToolCallsOpen((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    fontSize: 12,
                    padding: '4px 0',
                  }}
                >
                  {toolCallsOpen[msg.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  工具调用 ({msg.toolCalls.length})
                </button>
                {toolCallsOpen[msg.id] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {msg.toolCalls.map((tc, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--thinking-bg)',
                          border: '1px solid var(--thinking-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <div style={{ fontWeight: 500, marginBottom: 2 }}>{tc.name}</div>
                        {tc.result && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'auto' }}>
                            {tc.result}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Attached files display */}
            {msg.attachedFiles && msg.attachedFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.attachedFiles.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--bg-hover)',
                      color: msg.role === 'user' ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)',
                      cursor: f.dataUrl ? 'pointer' : 'default',
                    }}
                    onDoubleClick={() => { if (f.dataUrl) setPreviewImage(f.dataUrl) }}
                  >
                    {f.type.startsWith('image/') && f.dataUrl ? (
                      <img src={f.dataUrl} alt={f.name} style={{ width: 20, height: 20, borderRadius: 2, objectFit: 'cover' }} />
                    ) : f.type.startsWith('image/') ? (
                      <Image size={10} />
                    ) : (
                      <FileText size={10} />
                    )}
                    <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Message bubble or edit mode */}
            {editingMessageId === msg.id ? (
              <div style={{ maxWidth: '75%', width: '100%' }}>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSend(msg.id) }
                    if (e.key === 'Escape') { setEditingMessageId(null) }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: '10px 16px',
                    borderRadius: 'var(--radius) var(--radius) var(--radius) 4px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    border: 'none',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={() => setEditingMessageId(null)}
                    style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleEditSend(msg.id)}
                    disabled={!editText.trim()}
                    style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, background: editText.trim() ? 'var(--accent)' : 'var(--bg-tertiary)', color: editText.trim() ? '#fff' : 'var(--text-tertiary)' }}
                  >
                    发送
                  </button>
                </div>
              </div>
            ) : (
            <div className="copy-btn-parent" style={{ position: 'relative', display: 'inline-block', maxWidth: '75%' }}>
              <div
                className={msg.role === 'user' ? 'user-msg-bubble' : ''}
                style={{
                  padding: '10px 16px',
                  borderRadius: msg.role === 'user'
                    ? 'var(--radius) var(--radius) 4px var(--radius)'
                    : 'var(--radius) var(--radius) var(--radius) 4px',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  fontSize: 14,
                  lineHeight: 1.6,
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
              {msg.content && (
                <div style={{ position: 'absolute', right: 0, bottom: -18, display: 'flex', gap: 4 }}>
                  <CopyButton content={msg.content} />
                  {msg.role === 'user' && (
                    <button
                      onClick={() => { setEditingMessageId(msg.id); setEditText(msg.content) }}
                      title="编辑"
                      className="copy-btn"
                      style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 2 }}
                    >
                      <PenLine size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Model & token info */}
            {msg.role === 'assistant' && msg.model && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, padding: '0 4px' }}>
                {msg.model}
                {msg.tokenUsage && ` · ${formatTokenCount(msg.tokenUsage.totalTokens)} tokens`}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Context & token display */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '0 24px 4px',
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}
      >
        上下文: {formatTokenCount(totalTokens)} / {formatTokenCount(contextWindow)}
      </div>

      {/* Input area */}
      <div style={{ padding: '12px 24px 16px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {attachedFiles.map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  position: 'relative',
                  cursor: f.type.startsWith('image/') ? 'pointer' : 'default',
                }}
                onDoubleClick={() => {
                  if (f.type.startsWith('image/')) {
                    const reader = new FileReader()
                    reader.onload = () => setPreviewImage(reader.result as string)
                    reader.readAsDataURL(f)
                  }
                }}
              >
                {f.type.startsWith('image/') ? (
                  <ImagePreview file={f} />
                ) : (
                  <FileText size={12} />
                )}
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i)) }}
                  title="移除附件"
                  style={{ display: 'flex', background: 'transparent', color: 'var(--text-tertiary)', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-color)',
            padding: '8px 12px',
          }}
        >
          {/* File attach */}
          <button
            onClick={handleFileAttach}
            title="上传附件"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              flexShrink: 0,
              transition: 'var(--transition)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Paperclip size={16} />
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            style={{
              flex: 1,
              minWidth: 0,
              resize: 'none',
              fontSize: 14,
              lineHeight: 1.5,
              minHeight: 21,
              padding: '4px 0',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              overflowY: 'auto',
            }}
          />

          {/* Model selector */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                transition: 'var(--transition)',
              }}
            >
              {activeModel}
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
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow-lg)',
                  overflow: 'hidden',
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
                        cursor: p.configured ? 'default' : 'default',
                      }}
                    >
                      <img
                        src={p.icon}
                        alt={p.name}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 3,
                          filter: 'none',
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
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
                          setProvider(p.id)
                          setModel(m)
                          setModelSelectorOpen(false)
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '5px 12px 5px 36px',
                          fontSize: 12,
                          color: m === activeModel && p.id === activeProvider ? 'var(--accent)' : 'var(--text-secondary)',
                          background: m === activeModel && p.id === activeProvider ? 'var(--accent-light)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'var(--transition)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = m === activeModel && p.id === activeProvider ? 'var(--accent-light)' : 'transparent')}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            title="发送消息"
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: input.trim() && !isStreaming ? 'var(--accent)' : 'var(--bg-hover)',
              color: input.trim() && !isStreaming ? '#fff' : 'var(--text-tertiary)',
              flexShrink: 0,
              transition: 'var(--transition)',
            }}
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* Fullscreen image preview */}
      {previewImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
            cursor: 'pointer',
          }}
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  )
}
