// ==================== Common ====================
export type Theme = 'light' | 'dark'
export type Mode = 'chat' | 'code'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  timestamp: number
  model?: string
  tokenUsage?: TokenUsage
  attachedFiles?: { name: string; type: string; dataUrl?: string }[]
  toolCalls?: { name: string; args: Record<string, unknown>; result?: string }[]
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  contextWindow: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  model: string
  provider: string
  pinned?: boolean
  createdAt: number
  updatedAt: number
}

// ==================== Skills ====================
export interface Skill {
  id: string
  name: string
  description: string
  content: string
  chatEnabled: boolean
  codeEnabled: boolean
  createdAt: number
}

// ==================== Tools ====================
export interface Tool {
  id: string
  name: string
  description: string
  source?: string
  chatEnabled: boolean
  codeEnabled: boolean
  createdAt: number
}

// ==================== Cron Jobs ====================
export interface CronJob {
  id: string
  name: string
  prompt: string
  schedule: string
  enabled: boolean
  model: string
  provider: string
  skillIds: string[]
  toolNames: string[]
  createdAt: number
}

// ==================== Code ====================
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  expanded?: boolean
}

export interface CodeMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  timestamp: number
  model?: string
  tokenUsage?: TokenUsage
  referencedFiles?: string[]
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  status: 'pending' | 'running' | 'completed' | 'error'
}

export interface CodeConversation {
  id: string
  title: string
  projectPath: string
  messages: CodeMessage[]
  createdAt: number
  updatedAt: number
}
