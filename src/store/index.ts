import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme, Mode, Conversation, Message, Skill, Tool, CronJob, FileNode, CodeMessage, CodeConversation } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { authFetch } from '../utils/auth'

// Shared context window fallbacks
const CONTEXT_FALLBACK: Record<string, number> = {
  'gpt-4o': 128000, 'gpt-4o-mini': 128000, 'gpt-4-turbo': 128000, 'gpt-3.5-turbo': 16385,
  'o1': 200000, 'o1-mini': 128000, 'o3': 200000, 'o3-mini': 200000,
  'claude-sonnet-4-20250514': 200000, 'claude-3-5-haiku-20241022': 200000, 'claude-3-opus-20240229': 200000,
  'deepseek-v4-flash': 1000000, 'deepseek-v4-pro': 1000000,
  'mimo-v2.5-pro': 1000000, 'mimo-v2.5': 1000000, 'mimo-v2.5-asr': 1000000,
  'mimo-v2.5-tts': 1000000, 'mimo-v2.5-tts-voiceclone': 1000000, 'mimo-v2.5-tts-voicedesign': 1000000,
  'mimo-v2-pro': 1000000, 'mimo-v2-omni': 256000, 'mimo-v2-tts': 256000,
  'glm-4-plus': 128000, 'glm-4-flash': 128000, 'glm-4-long': 1000000, 'glm-4-air': 128000,
  'moonshot-v1-128k': 131072, 'moonshot-v1-32k': 32768, 'moonshot-v1-8k': 8192,
  'gemini-2.0-flash': 1048576, 'gemini-2.5-pro': 1048576, 'gemini-1.5-flash': 1048576,
}

// ==================== App Store ====================
interface AppState {
  theme: Theme
  mode: Mode
  leftSidebarOpen: boolean
  rightPanelOpen: boolean
  showSkillsPanel: boolean
  showCronPanel: boolean
  showToolsPanel: boolean
  showRagPanel: boolean
  toggleTheme: () => void
  setMode: (mode: Mode) => void
  toggleLeftSidebar: () => void
  toggleRightPanel: () => void
  setShowSkillsPanel: (v: boolean) => void
  setShowCronPanel: (v: boolean) => void
  setShowToolsPanel: (v: boolean) => void
  setShowRagPanel: (v: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      mode: 'chat',
      leftSidebarOpen: true,
      rightPanelOpen: true,
      showSkillsPanel: false,
      showCronPanel: false,
      showToolsPanel: false,
      showRagPanel: false,
      toggleTheme: () => set((s) => {
        const next = s.theme === 'dark' ? 'light' : 'dark'
        document.documentElement.classList.toggle('dark', next === 'dark')
        return { theme: next }
      }),
      setMode: (mode) => set({ mode }),
      toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
      setShowSkillsPanel: (v) => set({ showSkillsPanel: v }),
      setShowCronPanel: (v) => set({ showCronPanel: v }),
      setShowToolsPanel: (v) => set({ showToolsPanel: v }),
      setShowRagPanel: (v) => set({ showRagPanel: v }),
    }),
    { name: 'app-store' }
  )
)

// ==================== API Store ====================
export interface ApiProvider {
  id: string
  name: string
  icon: string
  configured: boolean
  models: string[]
  baseUrl: string
  apiKey: string
}

interface ApiState {
  providers: ApiProvider[]
  activeProvider: string
  activeModel: string
  configLoaded: boolean
  modelParams: { temperature: number; top_p: number; max_tokens: number; maxToolRounds: number }
  discoveredModels: Record<string, { id: string; context_length: number }[]>  // providerId -> models
  setProvider: (id: string) => void
  setModel: (model: string) => void
  updateProvider: (id: string, updates: Partial<ApiProvider>) => void
  setModelParams: (params: { temperature: number; top_p: number; max_tokens: number; maxToolRounds: number }) => void
  loadConfig: () => Promise<void>
  saveApiKey: (providerId: string, apiKey: string) => Promise<void>
  saveBaseUrl: (providerId: string, baseUrl: string) => Promise<void>
  fetchModels: (providerId: string) => Promise<string[]>
  getContextWindow: (providerId: string, modelId: string) => number
}

export const useApiStore = create<ApiState>()(
  persist(
    (set, get) => ({
      providers: [
        { id: 'openai', name: 'OpenAI', icon: '/logos/openai.svg', configured: false, apiKey: '', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], baseUrl: 'https://api.openai.com/v1' },
        { id: 'anthropic', name: 'Claude', icon: '/logos/anthropic.svg', configured: false, apiKey: '', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'], baseUrl: 'https://api.anthropic.com' },
        { id: 'deepseek', name: 'DeepSeek', icon: '/logos/deepseek.svg', configured: false, apiKey: '', models: ['deepseek-chat', 'deepseek-reasoner'], baseUrl: 'https://api.deepseek.com/v1' },
        { id: 'xiaomi', name: 'MiMo', icon: '/logos/xiaomi.svg', configured: false, apiKey: '', models: ['mimo-v2.5-pro', 'mimo-v2.5', 'mimo-v2-pro', 'mimo-v2-omni'], baseUrl: 'https://api.xiaomimimo.com/v1' },
        { id: 'zhipu', name: 'GLM', icon: '/logos/zhipu.svg', configured: false, apiKey: '', models: ['glm-4-plus', 'glm-4-flash', 'glm-4-long', 'glm-4-air'], baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
        { id: 'moonshot', name: '月之暗面', icon: '/logos/moonshot.svg', configured: false, apiKey: '', models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'], baseUrl: 'https://api.moonshot.cn/v1' },
        { id: 'google', name: 'Gemini', icon: '/logos/google.svg', configured: false, apiKey: '', models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'], baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
      ],
      activeProvider: 'openai',
      activeModel: 'gpt-4o',
      configLoaded: false,
      modelParams: { temperature: 0.7, top_p: 1.0, max_tokens: 4096, maxToolRounds: 10 },
      discoveredModels: {} as Record<string, { id: string; context_length: number }[]>,
      setProvider: (id) => set({ activeProvider: id }),
      setModel: (model) => set({ activeModel: model }),
      setModelParams: (params) => {
        set({ modelParams: params })
        authFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelParams: params }) }).catch(() => {})
      },
      updateProvider: (id, updates) => set((s) => ({
        providers: s.providers.map((p) => p.id === id ? { ...p, ...updates } : p)
      })),
      loadConfig: async () => {
        try {
          const res = await authFetch('/api/config')
          if (!res.ok) return
          const config = await res.json()
          const configuredIds: string[] = []
          set((s) => ({
            configLoaded: true,
            modelParams: config.modelParams || { temperature: 0.7, top_p: 1.0, max_tokens: 4096, maxToolRounds: 10 },
            providers: s.providers.map((p) => {
              const cfg = config.providers?.[p.id]
              if (cfg?.apiKey) {
                configuredIds.push(p.id)
                return { ...p, apiKey: cfg.apiKey, configured: true, baseUrl: cfg.baseUrl || p.baseUrl }
              }
              return p
            }),
          }))
          // Fetch models for all configured providers
          const state = get()
          for (const id of configuredIds) {
            state.fetchModels(id)
          }
        } catch {
          // backend not ready yet
        }
      },
      saveApiKey: async (providerId, apiKey) => {
        set((s) => ({
          providers: s.providers.map((p) =>
            p.id === providerId ? { ...p, apiKey, configured: apiKey.length > 0 } : p
          ),
        }))
        // Persist to config.json
        try {
          const res = await authFetch('/api/config')
          const config = await res.json()
          if (!config.providers[providerId]) config.providers[providerId] = {}
          config.providers[providerId].apiKey = apiKey
          // Also persist baseUrl (default from store)
          const storeProvider = get().providers.find(p => p.id === providerId)
          if (storeProvider?.baseUrl) config.providers[providerId].baseUrl = storeProvider.baseUrl
          await authFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
        } catch { /* ignore */ }
        // Auto-fetch models if key is set
        if (apiKey.length > 0) {
          const state = get()
          if (state.fetchModels) state.fetchModels(providerId)
        }
      },
      saveBaseUrl: async (providerId, baseUrl) => {
        set((s) => ({
          providers: s.providers.map((p) =>
            p.id === providerId ? { ...p, baseUrl } : p
          ),
        }))
        try {
          const res = await authFetch('/api/config')
          const config = await res.json()
          if (!config.providers[providerId]) config.providers[providerId] = {}
          config.providers[providerId].baseUrl = baseUrl
          await authFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
        } catch { /* ignore */ }
      },
      fetchModels: async (providerId) => {
        try {
          const res = await authFetch(`/api/models/${providerId}`)
          if (!res.ok) {
            return []
          }
          const data = await res.json()
          const models = (data.models || []).map((m: { id: string; context_length?: number }) => ({
            id: m.id,
            context_length: m.context_length || CONTEXT_FALLBACK[m.id] || 128000,
          }))
          const modelIds = models.map((m: { id: string }) => m.id)
          set((s) => ({
            discoveredModels: { ...s.discoveredModels, [providerId]: models },
            providers: s.providers.map((p) =>
              p.id === providerId ? { ...p, models: modelIds } : p
            ),
          }))
          return modelIds
        } catch (err) {
          return []
        }
      },
      getContextWindow: (providerId: string, modelId: string): number => {
        const state = get()
        const models = state.discoveredModels[providerId]
        if (models) {
          const found = models.find((m) => m.id === modelId)
          if (found && found.context_length > 128000) return found.context_length
        }
        return CONTEXT_FALLBACK[modelId] || 128000
      },
    }),
    { name: 'api-store' }
  )
)

// ==================== Chat Store ====================
interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  searchQuery: string
  setSearchQuery: (q: string) => void
  createConversation: () => string
  deleteConversation: (id: string) => void
  setActiveConversation: (id: string) => void
  addMessage: (conversationId: string, message: Message) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void
  updateTitle: (conversationId: string, title: string) => void
  truncateMessages: (conversationId: string, messageId: string) => void
  togglePin: (conversationId: string) => void
  getActiveConversation: () => Conversation | undefined
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),
      createConversation: () => {
        const id = uuidv4()
        const state = get()
        const provider = state.activeConversationId
          ? state.conversations.find(c => c.id === state.activeConversationId)
          : undefined
        const conv: Conversation = {
          id,
          title: '新对话',
          messages: [],
          model: provider?.model || 'gpt-4o',
          provider: provider?.provider || 'openai',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeConversationId: id,
        }))
        return id
      },
      deleteConversation: (id) => set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
        activeConversationId: s.activeConversationId === id
          ? s.conversations.find((c) => c.id !== id)?.id || null
          : s.activeConversationId,
      })),
      setActiveConversation: (id) => set({ activeConversationId: id }),
      addMessage: (conversationId, message) => set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, message],
                updatedAt: Date.now(),
                title: c.messages.length === 0 && message.role === 'user'
                  ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
                  : c.title,
              }
            : c
        ),
      })),
      updateMessage: (conversationId, messageId, updates) => set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, ...updates } : m
                ),
              }
            : c
        ),
      })),
      updateTitle: (conversationId, title) => set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, title } : c
        ),
      })),
      truncateMessages: (conversationId, messageId) => set((s) => ({
        conversations: s.conversations.map((c) => {
          if (c.id !== conversationId) return c
          const idx = c.messages.findIndex(m => m.id === messageId)
          if (idx === -1) return c
          return { ...c, messages: c.messages.slice(0, idx), updatedAt: Date.now() }
        }),
      })),
      togglePin: (conversationId) => set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, pinned: !c.pinned } : c
        ),
      })),
      getActiveConversation: () => {
        const s = get()
        return s.conversations.find((c) => c.id === s.activeConversationId)
      },
    }),
    { name: 'chat-store' }
  )
)

// ==================== Skills Store ====================
interface SkillsState {
  skills: Skill[]
  loadSkills: () => Promise<void>
  addSkill: (skill: Omit<Skill, 'id' | 'createdAt'>) => Promise<void>
  updateSkill: (id: string, updates: Partial<Skill>) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
  toggleChatSkill: (id: string) => Promise<void>
  toggleCodeSkill: (id: string) => Promise<void>
}

export const useSkillsStore = create<SkillsState>()(
  persist(
    (set, get) => ({
      skills: [],
      loadSkills: async () => {
        try {
          const res = await authFetch('/api/skills')
          if (res.ok) set({ skills: await res.json() })
        } catch {}
      },
      addSkill: async (skill) => {
        try {
          const res = await authFetch('/api/skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(skill),
          })
          if (res.ok) {
            const created = await res.json()
            set((s) => ({ skills: [...s.skills, created] }))
          }
        } catch {}
      },
      deleteSkill: async (id) => {
        set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) }))
        try {
          await authFetch(`/api/skills/${id}`, { method: 'DELETE' })
        } catch {}
      },
      updateSkill: async (id, updates) => {
        set((s) => ({ skills: s.skills.map((sk) => sk.id === id ? { ...sk, ...updates } : sk) }))
        try {
          await authFetch(`/api/skills/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
        } catch {}
      },
      toggleChatSkill: async (id) => {
        const sk = get().skills.find((s) => s.id === id)
        if (!sk) return
        const newVal = !sk.chatEnabled
        set((s) => ({ skills: s.skills.map((s) => s.id === id ? { ...s, chatEnabled: newVal } : s) }))
        try {
          await authFetch(`/api/skills/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatEnabled: newVal }),
          })
        } catch {}
      },
      toggleCodeSkill: async (id) => {
        const sk = get().skills.find((s) => s.id === id)
        if (!sk) return
        const newVal = !sk.codeEnabled
        set((s) => ({ skills: s.skills.map((s) => s.id === id ? { ...s, codeEnabled: newVal } : s) }))
        try {
          await authFetch(`/api/skills/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codeEnabled: newVal }),
          })
        } catch {}
      },
    }),
    { name: 'skills-store' }
  )
)

// ==================== Tools Store ====================
interface ToolsState {
  tools: Tool[]
  setTools: (tools: Tool[]) => void
  toggleChatTool: (id: string) => void
  toggleCodeTool: (id: string) => void
}

export const useToolsStore = create<ToolsState>()(
  persist(
    (set) => ({
      tools: [],
      setTools: (tools) => set({ tools }),
      toggleChatTool: (id) => set((s) => ({
        tools: s.tools.map((t) =>
          t.id === id ? { ...t, chatEnabled: !t.chatEnabled } : t
        ),
      })),
      toggleCodeTool: (id) => set((s) => ({
        tools: s.tools.map((t) =>
          t.id === id ? { ...t, codeEnabled: !t.codeEnabled } : t
        ),
      })),
    }),
    { name: 'tools-store' }
  )
)


// ==================== Code Store ====================
interface CodeState {
  projectPath: string | null
  fileTree: FileNode[]
  openFiles: string[]
  activeFile: string | null
  fileContents: Record<string, string>
  missingFiles: Record<string, boolean>
  splitMode: boolean
  rightPaneFiles: string[]
  rightPaneActive: string | null
  splitRatio: number
  terminalOpen: boolean
  terminalSessions: { id: string; cwd: string; title: string }[]
  terminalActiveId: string | null
  terminalHeight: number
  /** @deprecated migrated to codeConversations */
  messages?: CodeMessage[]
  codeConversations: CodeConversation[]
  activeCodeConversationId: string | null
  selectedFiles: string[]
  toolCalls: { name: string; args: Record<string, unknown>; result?: string; status: string }[]
  codeActiveProvider: string
  codeActiveModel: string
  setProjectPath: (path: string) => void
  setFileTree: (tree: FileNode[]) => void
  closeProject: () => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void
  reorderOpenFiles: (fromIndex: number, toIndex: number) => void
  splitFileRight: (path: string) => void
  closeRightFile: (path: string) => void
  setRightPaneActive: (path: string | null) => void
  setSplitRatio: (ratio: number) => void
  disableSplit: () => void
  openTerminal: (cwd: string, title: string) => void
  closeTerminal: (id: string) => void
  setTerminalActive: (id: string) => void
  updateTerminalTitle: (id: string, title: string) => void
  reorderTerminals: (fromIndex: number, toIndex: number) => void
  setTerminalHeight: (h: number) => void
  toggleTerminal: () => void
  setFileContent: (path: string, content: string) => void
  markFileMissing: (path: string) => void
  clearFileMissing: (path: string) => void
  toggleDirectory: (path: string) => void
  createCodeConversation: () => string
  deleteCodeConversation: (id: string) => void
  setActiveCodeConversation: (id: string) => void
  addCodeMessage: (msg: CodeMessage) => void
  updateCodeMessage: (id: string, updates: Partial<CodeMessage>) => void
  clearCodeMessages: () => void
  getActiveCodeConversation: () => CodeConversation | undefined
  toggleSelectedFile: (path: string) => void
  clearSelectedFiles: () => void
  addToolCall: (call: { name: string; args: Record<string, unknown>; result?: string; status: string }) => void
  clearToolCalls: () => void
  setCodeProvider: (id: string) => void
  setCodeModel: (model: string) => void
}

export const useCodeStore = create<CodeState>()(
  persist(
    (set, get) => ({
      projectPath: null,
      fileTree: [],
      openFiles: [],
      activeFile: null,
      fileContents: {},
      missingFiles: {},
      splitMode: false,
      rightPaneFiles: [],
      rightPaneActive: null,
      splitRatio: 0.5,
      terminalOpen: false,
      terminalSessions: [],
      terminalActiveId: null,
      terminalHeight: 250,
      codeConversations: [],
      activeCodeConversationId: null,
      selectedFiles: [],
      toolCalls: [],
      codeActiveProvider: 'openai',
      codeActiveModel: 'gpt-4o',
      setProjectPath: (path) => set({ projectPath: path }),
      setFileTree: (tree) => set({ fileTree: tree }),
      closeProject: () => set({
        projectPath: null,
        fileTree: [],
        openFiles: [],
        missingFiles: {},
        activeFile: null,
        fileContents: {},
        splitMode: false,
        rightPaneFiles: [],
        rightPaneActive: null,
        activeCodeConversationId: null,
        toolCalls: [],
      }),
      openFile: (path) => set((s) => ({
        openFiles: s.openFiles.includes(path) ? s.openFiles : [...s.openFiles, path],
        activeFile: path,
      })),
      closeFile: (path) => set((s) => ({
        openFiles: s.openFiles.filter((f) => f !== path),
        activeFile: s.activeFile === path ? (s.openFiles.filter((f) => f !== path)[0] || null) : s.activeFile,
      })),
      setActiveFile: (path) => set({ activeFile: path }),
      reorderOpenFiles: (fromIndex, toIndex) => set((s) => {
        const files = [...s.openFiles]
        const [moved] = files.splice(fromIndex, 1)
        files.splice(toIndex, 0, moved)
        return { openFiles: files }
      }),
      splitFileRight: (path) => set((s) => {
        if (!s.splitMode) {
          return {
            splitMode: true,
            openFiles: s.openFiles.filter(f => f !== path),
            rightPaneFiles: [...s.rightPaneFiles.filter(f => f !== path), path],
            rightPaneActive: path,
            activeFile: s.activeFile === path ? (s.openFiles.filter(f => f !== path)[0] || null) : s.activeFile,
          }
        }
        return {
          openFiles: s.openFiles.filter(f => f !== path),
          rightPaneFiles: s.rightPaneFiles.includes(path) ? s.rightPaneFiles : [...s.rightPaneFiles, path],
          rightPaneActive: path,
          activeFile: s.activeFile === path ? (s.openFiles.filter(f => f !== path)[0] || null) : s.activeFile,
        }
      }),
      closeRightFile: (path) => set((s) => ({
        rightPaneFiles: s.rightPaneFiles.filter(f => f !== path),
        rightPaneActive: s.rightPaneActive === path ? (s.rightPaneFiles.filter(f => f !== path)[0] || null) : s.rightPaneActive,
        splitMode: s.rightPaneFiles.filter(f => f !== path).length > 0,
      })),
      setRightPaneActive: (path) => set({ rightPaneActive: path }),
      setSplitRatio: (ratio) => set({ splitRatio: Math.max(0.15, Math.min(0.85, ratio)) }),
      disableSplit: () => set((s) => ({
        splitMode: false,
        openFiles: [...new Set([...s.openFiles, ...s.rightPaneFiles])],
        rightPaneFiles: [],
        rightPaneActive: null,
      })),
      openTerminal: (cwd, title) => {
        const id = Date.now().toString()
        set((s) => ({
          terminalOpen: true,
          terminalSessions: [...s.terminalSessions, { id, cwd, title }],
          terminalActiveId: id,
        }))
      },
      closeTerminal: (id) => set((s) => {
        const remaining = s.terminalSessions.filter(t => t.id !== id)
        return {
          terminalSessions: remaining,
          terminalActiveId: s.terminalActiveId === id ? (remaining[0]?.id || null) : s.terminalActiveId,
          terminalOpen: remaining.length > 0,
        }
      }),
      setTerminalActive: (id) => set({ terminalActiveId: id }),
      updateTerminalTitle: (id, title) => set((s) => ({
        terminalSessions: s.terminalSessions.map(t => t.id === id ? { ...t, title } : t),
      })),
      reorderTerminals: (fromIndex, toIndex) => set((s) => {
        const sessions = [...s.terminalSessions]
        const [moved] = sessions.splice(fromIndex, 1)
        sessions.splice(toIndex, 0, moved)
        return { terminalSessions: sessions }
      }),
      setTerminalHeight: (h) => set({ terminalHeight: Math.max(100, Math.min(800, h)) }),
      toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
      setFileContent: (path, content) => set((s) => ({
        fileContents: { ...s.fileContents, [path]: content },
        missingFiles: { ...(s.missingFiles || {}), [path]: false },
      })),
      markFileMissing: (path) => set((s) => ({
        missingFiles: { ...(s.missingFiles || {}), [path]: true },
      })),
      clearFileMissing: (path) => set((s) => ({
        missingFiles: { ...(s.missingFiles || {}), [path]: false },
      })),
      toggleDirectory: (path) => set((s) => {
        const toggle = (nodes) => nodes.map((n) => {
          if (n.path === path) return { ...n, expanded: !n.expanded }
          if (n.children) return { ...n, children: toggle(n.children) }
          return n
        })
        return { fileTree: toggle(s.fileTree) }
      }),
      createCodeConversation: () => {
        const id = uuidv4()
        const state = get()
        const conv = {
          id,
          title: '新对话',
          projectPath: state.projectPath || '',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => ({
          codeConversations: [conv, ...s.codeConversations],
          activeCodeConversationId: id,
        }))
        return id
      },
      deleteCodeConversation: (id) => set((s) => ({
        codeConversations: s.codeConversations.filter((c) => c.id !== id),
        activeCodeConversationId: s.activeCodeConversationId === id
          ? (s.codeConversations.find((c) => c.id !== id)?.id || null)
          : s.activeCodeConversationId,
      })),
      setActiveCodeConversation: (id) => set({ activeCodeConversationId: id }),
      addCodeMessage: (msg) => set((s) => {
        const convs = s.codeConversations.map((c) => {
          if (c.id === s.activeCodeConversationId) {
            return {
              ...c,
              messages: [...c.messages, msg],
              updatedAt: Date.now(),
              title: c.messages.length === 0 && msg.role === 'user'
                ? msg.content.slice(0, 30) + (msg.content.length > 30 ? '...' : '')
                : c.title,
            }
          }
          return c
        })
        return { codeConversations: convs }
      }),
      updateCodeMessage: (id, updates) => set((s) => ({
        codeConversations: s.codeConversations.map((c) => {
          if (c.id === s.activeCodeConversationId) {
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === id ? { ...m, ...updates } : m
              ),
            }
          }
          return c
        }),
      })),
      clearCodeMessages: () => set((s) => ({
        codeConversations: s.codeConversations.map((c) =>
          c.id === s.activeCodeConversationId ? { ...c, messages: [] } : c
        ),
      })),
      getActiveCodeConversation: () => {
        const s = get()
        return s.codeConversations.find((c) => c.id === s.activeCodeConversationId)
      },
      toggleSelectedFile: (path) => set((s) => ({
        selectedFiles: s.selectedFiles.includes(path)
          ? s.selectedFiles.filter((f) => f !== path)
          : [...s.selectedFiles, path],
      })),
      clearSelectedFiles: () => set({ selectedFiles: [] }),
      addToolCall: (call) => set((s) => ({ toolCalls: [...s.toolCalls, call] })),
      clearToolCalls: () => set({ toolCalls: [] }),
      setCodeProvider: (id) => set({ codeActiveProvider: id }),
      setCodeModel: (model) => set({ codeActiveModel: model }),
      updateTitle: (conversationId, title) => set((s) => ({
        codeConversations: s.codeConversations.map((c) =>
          c.id === conversationId ? { ...c, title } : c
        ),
      })),
    }),
    {
      name: 'code-store',
      onRehydrateStorage: () => (state) => {
        if (state?.messages && state.messages.length > 0 && state.codeConversations.length === 0) {
          const conv = {
            id: uuidv4(),
            title: '旧对话',
            projectPath: state.projectPath || '',
            messages: state.messages,
            createdAt: state.messages[0]?.timestamp || Date.now(),
            updatedAt: Date.now(),
          }
          state.codeConversations = [conv]
          state.activeCodeConversationId = conv.id
          delete state.messages
        }
      },
    }
  )
)
