interface ExportMessage {
  role: string
  content: string
  thinking?: string
  timestamp: number
  model?: string
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number; contextWindow: number }
  toolCalls?: { name: string; result?: string }[]
  referencedFiles?: string[]
}

export function exportAsMarkdown(title: string, messages: ExportMessage[]): string {
  const lines: string[] = []
  lines.push(`# ${title}`)
  lines.push('')

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleString('zh-CN')
    const roleLabel = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? 'AI' : '系统'
    const header = msg.model
      ? `**${roleLabel}** (${msg.model}) — ${time}`
      : `**${roleLabel}** — ${time}`

    lines.push(header)
    lines.push('')

    if (msg.thinking) {
      lines.push('> 💭 思考过程:')
      lines.push('>')
      for (const line of msg.thinking.split('\n')) {
        lines.push(`> ${line}`)
      }
      lines.push('>')
      lines.push('')
    }

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push('> 🔧 工具调用:')
      for (const tc of msg.toolCalls) {
        lines.push(`> - ${tc.name}`)
        if (tc.result) {
          for (const line of tc.result.slice(0, 300).split('\n')) {
            lines.push(`>   ${line}`)
          }
        }
      }
      lines.push('>')
      lines.push('')
    }

    lines.push(msg.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

export function exportAsJSON(title: string, messages: ExportMessage[]): string {
  return JSON.stringify({
    title,
    exportedAt: new Date().toISOString(),
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      thinking: m.thinking || undefined,
      timestamp: m.timestamp,
      model: m.model || undefined,
      tokenUsage: m.tokenUsage || undefined,
      toolCalls: m.toolCalls || undefined,
    })),
  }, null, 2)
}

export function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
