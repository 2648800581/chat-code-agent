import type { TokenUsage } from '../types'
import type { ApiProvider } from '../store'
import { authFetch } from './auth'

interface StreamCallbacks {
  onToken: (token: string) => void
  onThinking: (token: string) => void
  onToolCalls?: (calls: { name: string; args: Record<string, unknown>; result?: string }[]) => void
  onDone: (usage?: TokenUsage) => void
  onError: (error: string) => void
}

export async function streamChat(
  provider: ApiProvider,
  model: string,
  apiKey: string,
  messages: { role: string; content: string | unknown[] }[],
  callbacks: StreamCallbacks,
  contextWindow: number = 128000,
  systemMessage?: string,
  enabledTools?: string[]
): Promise<void> {
  const finalMessages = systemMessage
    ? [{ role: 'system', content: systemMessage }, ...messages]
    : messages

  try {
    const response = await authFetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: provider.id,
        model,
        apiKey,
        baseUrl: provider.baseUrl,
        messages: finalMessages,
        enabledTools,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      callbacks.onError(`API Error (${response.status}): ${errText}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError('No response body')
      return
    }

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
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          callbacks.onDone()
          return
        }

        try {
          const parsed = JSON.parse(data)

          // Anthropic format
          if (provider.id === 'anthropic') {
            if (parsed.type === 'content_block_delta') {
              if (parsed.delta?.type === 'thinking_delta') {
                callbacks.onThinking(parsed.delta.thinking)
              } else if (parsed.delta?.type === 'text_delta') {
                callbacks.onToken(parsed.delta.text)
              }
            }
            if (parsed.type === 'message_delta' && parsed.usage) {
              callbacks.onDone({
                promptTokens: 0,
                completionTokens: parsed.usage.output_tokens,
                totalTokens: parsed.usage.output_tokens,
                contextWindow,
              })
            }
            continue
          }

          // OpenAI-compatible format (backend custom SSE)
          if (parsed.type === 'content') {
            callbacks.onToken(parsed.content)
            continue
          }
          if (parsed.type === 'thinking') {
            callbacks.onThinking(parsed.content)
            continue
          }
          if (parsed.type === 'tool_calls') {
            if (callbacks.onToolCalls && parsed.calls) {
              callbacks.onToolCalls(parsed.calls)
            }
            continue
          }
          if (parsed.type === 'done') {
            if (parsed.usage) {
              callbacks.onDone({
                promptTokens: parsed.usage.prompt_tokens || 0,
                completionTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0,
                contextWindow,
              })
            } else {
              callbacks.onDone()
            }
            return
          }

          // Fallback: raw OpenAI SSE format
          const delta = parsed.choices?.[0]?.delta
          if (delta) {
            if (delta.reasoning_content || delta.thinking) {
              callbacks.onThinking(delta.reasoning_content || delta.thinking)
            } else if (delta.content) {
              callbacks.onToken(delta.content)
            }
          }

          if (parsed.usage) {
            callbacks.onDone({
              promptTokens: parsed.usage.prompt_tokens || 0,
              completionTokens: parsed.usage.completion_tokens || 0,
              totalTokens: parsed.usage.total_tokens || 0,
              contextWindow,
            })
          }
        } catch {
          // skip non-JSON lines
        }
      }
    }

    callbacks.onDone()
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : 'Unknown error')
  }
}

export function formatTokenCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
