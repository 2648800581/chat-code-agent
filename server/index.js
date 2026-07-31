import express from 'express'
import http from 'http'
import cors from 'cors'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { initScheduler, getJobs, addJob, updateJob, deleteJob, getResults, deleteResult, clearResults, runJobNow } from './cronScheduler.js'
import { loadSkills, saveSkills } from './skillsStore.js'
import { McpClient } from './mcpClient.js'
import { CODE_TOOLS, executeTool, isPathAllowed, setWebSearchKey, setApiConfigGetter } from './tools.js'
import { attachTerminal } from './terminal.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 公共函数：解析 SSE 流式响应
async function parseStreamChunk(reader, decoder, buffer, callbacks) {
  const { done, value } = await reader.read()
  if (done) return { done, buffer, accContent: callbacks.accContent, accToolCalls: callbacks.accToolCalls, finishReason: callbacks.finishReason, apiUsage: callbacks.apiUsage }
  
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data: ')) continue
    const payload = trimmed.slice(6)
    if (payload === '[DONE]') continue

    try {
      const chunk = JSON.parse(payload)
      const delta = chunk.choices?.[0]?.delta

      if (chunk.usage) callbacks.apiUsage = chunk.usage
      if (!delta) continue

      if (delta.content) {
        callbacks.accContent += delta.content
        callbacks.onContent?.(delta.content)
      }

      const thinkingDelta = delta.reasoning_content || delta.thinking
      if (thinkingDelta) callbacks.onThinking?.(thinkingDelta)

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!callbacks.accToolCalls[idx]) {
            callbacks.accToolCalls[idx] = { id: tc.id || '', function: { name: '', arguments: '' } }
          }
          if (tc.id) callbacks.accToolCalls[idx].id = tc.id
          if (tc.function?.name) callbacks.accToolCalls[idx].function.name += tc.function.name
          if (tc.function?.arguments) callbacks.accToolCalls[idx].function.arguments += tc.function.arguments
        }
      }

      if (chunk.choices?.[0]?.finish_reason) {
        callbacks.finishReason = chunk.choices[0].finish_reason
      }
    } catch {}
  }

  return { done: false, buffer, accContent: callbacks.accContent, accToolCalls: callbacks.accToolCalls, finishReason: callbacks.finishReason, apiUsage: callbacks.apiUsage }
}

// 公共函数：处理 tool_calls 并构建 assistant/tool 消息
async function handleToolCalls(accToolCalls, apiMessages, sendSSE, collectForFrontend) {
  const assistantMsg = { role: 'assistant', content: null, tool_calls: accToolCalls.map((tc, i) => ({
    id: tc.id || `call_${Date.now()}_${i}`,
    type: 'function',
    function: { name: tc.function.name, arguments: tc.function.arguments },
  }))}
  apiMessages.push(assistantMsg)

  for (const tc of accToolCalls) {
    let args = {}
    try { args = JSON.parse(tc.function.arguments || '{}') } catch {}
    // Route MCP tools
    let result
    const mcpClient = getMcpClientByTool(tc.function.name)
    if (mcpClient) {
      try {
        const mcpResult = await mcpClient.callTool(tc.function.name, args)
        result = typeof mcpResult === 'string' ? mcpResult : JSON.stringify(mcpResult, null, 2)
      } catch (err) {
        result = `MCP 工具调用失败: ${err.message}`
      }
    } else {
      result = await executeTool(tc.function.name, args)
    }
    collectForFrontend.push({ name: tc.function.name, args, result: result.slice(0, 500) })
    apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result })
  }
}

// 公共函数：读取 SSE 响应流，返回累积的 content + tool_calls + usage
async function readStreamToCompletion(response, sendSSE) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accContent = ''
  let accToolCalls = []
  let finishReason = null
  let apiUsage = null

  const callbacks = {
    accContent, accToolCalls, finishReason, apiUsage,
    onContent: (c) => sendSSE({ type: 'content', content: c }),
    onThinking: (t) => sendSSE({ type: 'thinking', content: t }),
  }

  while (true) {
    const result = await parseStreamChunk(reader, decoder, buffer, callbacks)
    if (result.done) break
    buffer = result.buffer
  }

  return {
    accContent: callbacks.accContent,
    accToolCalls: callbacks.accToolCalls,
    finishReason: callbacks.finishReason,
    apiUsage: callbacks.apiUsage,
  }
}

// Token 估算函数：中英文混合场景更准确
function estimateTokens(text) {
  if (!text) return 0
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const otherChars = text.length - chineseChars
  // 中文约 1.5 字符/token，英文约 4 字符/token
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}
const app = express()
const PORT = 3210

// 生成认证 Token
const AUTH_TOKEN = crypto.randomBytes(32).toString('hex')
const AUTH_TOKEN_PATH = path.resolve(__dirname, '../.auth-token')

// 保存 Token 到文件（供前端读取）
fs.writeFileSync(AUTH_TOKEN_PATH, AUTH_TOKEN, 'utf-8')
fs.chmodSync(AUTH_TOKEN_PATH, 0o600)
console.log(`[auth] Authentication token saved to: ${AUTH_TOKEN_PATH}`)
console.log(`[auth] Token: ${AUTH_TOKEN}`)

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '10mb' }))

// 认证中间件（排除登录验证端点）
app.use((req, res, next) => {
  // 跳过认证验证端点
  if (req.path === '/api/auth/verify') {
    return next()
  }
  
  // 验证 Authorization header
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }
  
  const token = authHeader.slice(7) // 移除 "Bearer " 前缀
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' })
  }
  
  next()
})

// Load config
const CONFIG_PATH = path.resolve(__dirname, '../config.json')

// 基于机器信息生成加密密钥
const CIPHER_KEY = crypto.createHash('sha256')
  .update(os.hostname() + os.userInfo().username)
  .digest()
const CIPHER_IV = CIPHER_KEY.slice(0, 16)

// 加密函数
function encrypt(text) {
  if (!text) return ''
  const cipher = crypto.createCipheriv('aes-256-cbc', CIPHER_KEY, CIPHER_IV)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

// 解密函数
function decrypt(encrypted) {
  if (!encrypted) return ''
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', CIPHER_KEY, CIPHER_IV)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return encrypted  // 如果解密失败，返回原文（兼容未加密的旧数据）
  }
}

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    const config = { ...raw, providers: {} }
    // 确保 modelParams 有默认值，并迁移旧格式 maxToolRounds
    if (!config.modelParams) {
      config.modelParams = { temperature: 0.7, top_p: 1.0, max_tokens: 4096, maxToolRounds: 10 }
    }
    if (typeof config.maxToolRounds === 'number') {
      if (!config.modelParams.maxToolRounds) config.modelParams.maxToolRounds = config.maxToolRounds
      delete config.maxToolRounds
    }
    if (!config.modelParams.maxToolRounds) config.modelParams.maxToolRounds = 10
    let needsEncrypt = false
    // 解密所有 provider 的 apiKey
    for (const [id, provider] of Object.entries(raw.providers || {})) {
      if (provider.apiKey) {
        const decrypted = decrypt(provider.apiKey)
        // 如果解密后与原文相同，说明是明文 Key，需要加密
        if (decrypted === provider.apiKey && provider.apiKey.length > 0) {
          needsEncrypt = true
        }
        config.providers[id] = { ...provider, apiKey: decrypted }
      } else {
        config.providers[id] = { ...provider, apiKey: '' }
      }
    }
    // 解密 webSearch apiKey
    if (raw.webSearch?.apiKey) {
      config.webSearch = { ...raw.webSearch, apiKey: decrypt(raw.webSearch.apiKey) }
    }
    // 解密 embedding apiKey
    if (raw.embedding?.apiKey) {
      config.embedding = { ...raw.embedding, apiKey: decrypt(raw.embedding.apiKey) }
    }
    // 如果有明文 Key，自动加密后保存
    if (needsEncrypt) {
      saveConfig(config)
    }
    return config
  } catch {
    return { providers: {} }
  }
}

function saveConfig(config) {
  // 加密所有 provider 的 apiKey 后写入
  const encrypted = { ...loadConfig(), ...config }
  if (config.providers) {
    encrypted.providers = { ...encrypted.providers, ...config.providers }
  }
  const toSave = { ...encrypted, providers: {} }
  for (const [id, provider] of Object.entries(encrypted.providers || {})) {
    toSave.providers[id] = {
      ...provider,
      apiKey: encrypt(provider.apiKey || ''),
    }
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2))
}

// ==================== MCP Server Management ====================

let mcpClients = new Map()

function getMcpConfig() {
  const config = loadConfig()
  return config.mcpServers || []
}

function saveMcpConfig(servers) {
  const config = loadConfig()
  config.mcpServers = servers.map((s) => ({
    ...s,
    token: s.token ? encrypt(s.token) : '',
  }))
  // Write directly to avoid double-encrypting tokens
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  raw.mcpServers = config.mcpServers
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(raw, null, 2))
}

async function initMcp() {
  const servers = getMcpConfig()
  for (const serverConfig of servers) {
    if (!serverConfig.enabled) continue
    const decrypted = { ...serverConfig }
    if (serverConfig.token) decrypted.token = decrypt(serverConfig.token)
    const client = new McpClient(decrypted)
    await client.connect()
    mcpClients.set(serverConfig.id, client)
    if (client.connected) {
      console.log(`MCP Server "${serverConfig.name}" connected (${client.tools.length} tools)`)
    } else {
      console.log(`MCP Server "${serverConfig.name}" failed: ${client.error}`)
    }
  }
}

function getAllMcpTools() {
  const tools = []
  for (const client of mcpClients.values()) {
    if (client.connected) {
      tools.push(...client.getToolDefinitions())
    }
  }
  return tools
}

function getMcpClientByTool(toolName) {
  for (const client of mcpClients.values()) {
    if (client.connected && client.tools.some(t => t.name === toolName)) {
      return client
    }
  }
  return null
}

// ==================== MCP API ====================

app.get('/api/mcp/servers', (req, res) => {
  const servers = getMcpConfig().map((s) => ({
    ...s,
    token: s.token ? '••••••••' : '',
  }))
  res.json(servers)
})

app.post('/api/mcp/servers', (req, res) => {
  const { name, type, command, args, url, token, env, enabled } = req.body
  if (!name || !type) return res.status(400).json({ error: 'Name and type required' })
  const servers = getMcpConfig()
  const id = crypto.randomUUID()
  const newServer = { id, name, type, command: command || '', args: args || [], url: url || '', token: token || '', env: env || {}, enabled: enabled ?? true }
  servers.push(newServer)
  saveMcpConfig(servers)
  // Connect immediately with proper env for stdio
  const clientConfig = { ...newServer, token: token || '' }
  if (type === 'stdio' && token) {
    clientConfig.env = { ...clientConfig.env, GITHUB_PERSONAL_ACCESS_TOKEN: token }
  }
  const client = new McpClient(clientConfig)
  client.connect().then(() => {
    mcpClients.set(id, client)
  }).catch(() => {})
  res.json({ id, name, type, connected: false })
})

app.put('/api/mcp/servers/:id', (req, res) => {
  const { id } = req.params
  const servers = getMcpConfig()
  const idx = servers.findIndex((s) => s.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  servers[idx] = { ...servers[idx], ...req.body }
  saveMcpConfig(servers)
  // Reconnect
  const existing = mcpClients.get(id)
  if (existing) mcpClients.delete(id)
  const decrypted = { ...servers[idx] }
  if (servers[idx].token) decrypted.token = decrypt(servers[idx].token)
  const client = new McpClient(decrypted)
  client.connect().then(() => { mcpClients.set(id, client) })
  res.json({ ok: true })
})

app.delete('/api/mcp/servers/:id', (req, res) => {
  const { id } = req.params
  mcpClients.delete(id)
  const servers = getMcpConfig().filter((s) => s.id !== id)
  saveMcpConfig(servers)
  res.json({ ok: true })
})

// ==================== Auth API ====================

// Web search API key
app.post('/api/config/websearch', (req, res) => {
  const { apiKey } = req.body
  const config = loadConfig()
  if (!config.webSearch) config.webSearch = {}
  config.webSearch.apiKey = apiKey ? encrypt(apiKey) : ''
  saveConfig({ webSearch: config.webSearch })
  setWebSearchKey(apiKey || '')
  res.json({ ok: true })
})

// Embedding API config
app.post('/api/config/embedding', (req, res) => {
  const { apiKey, baseUrl, model } = req.body
  const config = loadConfig()
  if (!config.embedding) config.embedding = {}
  config.embedding.apiKey = apiKey ? encrypt(apiKey) : ''
  config.embedding.baseUrl = baseUrl || ''
  config.embedding.model = model || 'jina-embeddings-v3'
  saveConfig({ embedding: config.embedding })
  res.json({ ok: true })
})

app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body
  if (!token) {
    return res.status(400).json({ error: 'Token is required' })
  }
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' })
  }
  res.json({ success: true, message: 'Token verified' })
})

// ==================== Config API ====================

app.get('/api/config', (_req, res) => {
  const config = loadConfig()
  config.mcpTools = getAllMcpTools()
  res.json(config)
})

app.post('/api/config', (req, res) => {
  saveConfig(req.body)
  res.json({ ok: true })
})

app.post('/api/config/provider/:id', (req, res) => {
  const config = loadConfig()
  const { id } = req.params
  if (!config.providers[id]) config.providers[id] = {}
  Object.assign(config.providers[id], req.body)
  saveConfig(config)
  res.json({ ok: true })
})

// ==================== Title Generation API ====================

app.post('/api/chat/title', async (req, res) => {
  const { model, apiKey, baseUrl, message } = req.body
  if (!message) return res.status(400).json({ error: 'No message' })
  if (!apiKey) return res.status(400).json({ error: 'No apiKey' })

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: `直接回答不要思考：用5-15个字概括——"${message}"` },
        ],
        ...loadConfig().modelParams,
      }),
    })
    if (!response.ok) {
      return res.status(500).json({ error: `API error: ${response.status}` })
    }
    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim() || ''
    const cleaned = raw.replace(/^["'「」【】《》\s]+|["'「」【】《》\s]+$/g, '')
    res.json({ title: cleaned || message.slice(0, 20) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ==================== Models Discovery API ====================

app.get('/api/models/:providerId', async (req, res) => {
  const { providerId } = req.params
  const config = loadConfig()
  const providerConfig = config.providers?.[providerId]

  if (!providerConfig?.apiKey) {
    return res.status(400).json({ error: 'Provider not configured' })
  }

  const { apiKey, baseUrl } = providerConfig
  const headers = { 'Authorization': `Bearer ${apiKey}` }

  // Anthropic doesn't have a standard /v1/models endpoint
  if (providerId === 'anthropic') {
    return res.json({
      models: [
        { id: 'claude-sonnet-4-20250514', name: 'claude-sonnet-4-20250514', context_length: 200000 },
        { id: 'claude-3-5-haiku-20241022', name: 'claude-3-5-haiku-20241022', context_length: 200000 },
        { id: 'claude-3-opus-20240229', name: 'claude-3-opus-20240229', context_length: 200000 },
      ]
    })
  }

  // Google Gemini has a different endpoint format
  if (providerId === 'google') {
    try {
      const response = await fetch(`${baseUrl}/models?key=${apiKey}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const models = (data.models || []).map(m => ({
        id: m.name?.replace('models/', ''),
        name: m.displayName || m.name?.replace('models/', ''),
        context_length: m.inputTokenLimit || 1048576,
      }))
      return res.json({ models })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // OpenAI-compatible providers (openai, deepseek, xiaomi, zhipu, moonshot)
  try {
    const response = await fetch(`${baseUrl}/models`, { headers })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const models = (data.data || []).map(m => ({
      id: m.id,
      name: m.id,
      context_length: m.context_length || null,
    }))
    return res.json({ models })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})


// ==================== Tools Discovery API ====================

app.get('/api/tools', (_req, res) => {
  const builtIn = CODE_TOOLS.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    source: 'built-in',
  }))
  const mcpTools = getAllMcpTools().map((t) => ({
    name: t.function.name,
    description: t.function.description,
    source: 'mcp',
  }))
  res.json([...builtIn, ...mcpTools])
})

// ==================== Skills API ====================

app.get('/api/skills', (_req, res) => {
  res.json(loadSkills())
})

app.post('/api/skills', (req, res) => {
  const skills = loadSkills()
  const skill = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ...req.body,
    createdAt: Date.now(),
  }
  skills.push(skill)
  saveSkills(skills)
  res.json(skill)
})

app.put('/api/skills/:id', (req, res) => {
  const skills = loadSkills()
  const idx = skills.findIndex((s) => s.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Skill not found' })
  Object.assign(skills[idx], req.body)
  saveSkills(skills)
  res.json(skills[idx])
})

app.delete('/api/skills/:id', (req, res) => {
  let skills = loadSkills()
  skills = skills.filter((s) => s.id !== req.params.id)
  saveSkills(skills)
  res.json({ ok: true })
})

// ==================== Code Chat API (with tool loop) ====================

app.post('/api/code/chat', async (req, res) => {
  const { provider, model, apiKey, baseUrl, messages, projectPath, selectedFiles, enabledSkills, enabledTools } = req.body
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }

  // Filter tools based on enabledTools: array → filter, undefined → all tools
  const allToolDefs = [...CODE_TOOLS, ...getAllMcpTools()]
  const tools = Array.isArray(enabledTools)
    ? allToolDefs.filter((t) => enabledTools.includes(t.function.name))
    : allToolDefs

  // Add system message about project context
  let systemContent = `你是由 ${provider} 提供的 ${model} 模型。当前项目路径: ${projectPath || '未指定'}。`
  if (tools.length > 0) {
    const toolNames = tools.map((t) => t.function.name).join('、')
    systemContent += `你可以使用以下工具：${toolNames}。`
  }
  if (selectedFiles && selectedFiles.length > 0) {
    const fileList = selectedFiles.map((f) => f.split('/').pop()).join('、')
    if (tools.some((t) => t.function.name === 'read_file')) {
      systemContent += `\n\n注意：用户在对话前特别选择了以下项目文件，请优先使用 read_file 工具阅读这些文件的内容来回答用户的问题：${fileList}（完整路径：${selectedFiles.join('、')}）`
    } else {
      systemContent += `\n\n注意：用户在对话前特别选择了以下项目文件：${fileList}（完整路径：${selectedFiles.join('、')}）`
    }
  }
  if (enabledSkills && enabledSkills.length > 0) {
    const list = enabledSkills.map(s => `${s.name} - ${s.description}`).join(', ')
    systemContent += `\n\n可用 Skills: ${list}`
    systemContent += '\n若用户意图与某个 Skill 相关，务必先调用 load_skill 工具获取完整指令再回答；否则忽略。'
  }
  const systemMsg = { role: 'system', content: systemContent }
  const apiMessages = [systemMsg, ...messages]

  const maxRounds = loadConfig().modelParams.maxToolRounds || 10
  let toolCallsForFrontend = []

  // Set SSE headers once
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendSSE = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  for (let round = 0; round < maxRounds; round++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: apiMessages, tools, stream: true, stream_options: { include_usage: true }, ...loadConfig().modelParams }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        const errText = await response.text()
        console.error(`[code/chat] API error (${response.status}):`, errText.slice(0, 300))
        sendSSE({ type: 'content', content: `API Error (${response.status}): ${errText.slice(0, 200)}` })
        sendSSE({ type: 'done' })
        res.end()
        return
      }

      // Read SSE stream from API
      const { accContent, accToolCalls, finishReason, apiUsage } = await readStreamToCompletion(response, sendSSE)

      // If model wants to call tools
      if (finishReason === 'tool_calls' && accToolCalls.length > 0) {
        await handleToolCalls(accToolCalls, apiMessages, sendSSE, toolCallsForFrontend)
        continue
      }

      // Final response
      if (toolCallsForFrontend.length > 0) {
        sendSSE({ type: 'tool_calls', calls: toolCallsForFrontend })
      }
      if (!apiUsage) {
        const promptText = apiMessages.map(m => typeof m.content === 'string' ? m.content : '').join('')
        apiUsage = {
          prompt_tokens: estimateTokens(promptText),
          completion_tokens: estimateTokens(accContent),
          total_tokens: estimateTokens(promptText) + estimateTokens(accContent),
          estimated: true,
        }
      }
      sendSSE({ type: 'done', usage: apiUsage })
      res.end()
      return

    } catch (err) {
      console.error(`[code/chat] Error in round ${round}:`, err.message)
      sendSSE({ type: 'content', content: `Error: ${err.message}` })
      sendSSE({ type: 'done' })
      res.end()
      return
    }
  }

  sendSSE({ type: 'content', content: '超过最大工具调用轮数' })
  sendSSE({ type: 'done' })
  res.end()
})

// ==================== Chat API (streaming proxy) ====================

app.post('/api/chat/stream', async (req, res) => {
  const { provider, model, messages, apiKey, baseUrl } = req.body
  const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'))
  if (hasImages) {
    console.log(`[chat/stream] Multi-modal request: ${model}, payload size: ${JSON.stringify(req.body).length} bytes`)
  }

  const headers = { 'Content-Type': 'application/json' }

  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'

    // 提取 system message，放入 Anthropic 的 system 参数
    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMsgs = messages.filter(m => m.role !== 'system')

    try {
      const body = {
        model,
        max_tokens: 4096,
        stream: true,
        messages: nonSystemMsgs,
        ...loadConfig().modelParams,
      }
      if (systemMsg?.content) {
        body.system = systemMsg.content
      }

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(decoder.decode(value, { stream: true }))
      }
      res.end()
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
    return
  }

  // OpenAI-compatible providers
  headers['Authorization'] = `Bearer ${apiKey}`

  const maxRounds = loadConfig().modelParams.maxToolRounds || 10
  const allToolDefs = [...CODE_TOOLS, ...getAllMcpTools()]
  const tools = Array.isArray(req.body.enabledTools)
    ? allToolDefs.filter((t) => req.body.enabledTools.includes(t.function.name))
    : allToolDefs
  const hasTools = tools.length > 0
  const apiMessages = [...messages]
  let toolCallsForFrontend = []

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendSSE = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  for (let round = 0; round < maxRounds; round++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)

      const body = { model, stream: true, messages: apiMessages, stream_options: { include_usage: true }, ...loadConfig().modelParams }
      if (hasTools) body.tools = tools

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        const errText = await response.text()
        console.error(`[chat/stream] API error (${response.status}):`, errText.slice(0, 300))
        sendSSE({ type: 'content', content: `API Error (${response.status}): ${errText.slice(0, 200)}` })
        sendSSE({ type: 'done' })
        res.end()
        return
      }

      const { accContent, accToolCalls, finishReason, apiUsage } = await readStreamToCompletion(response, sendSSE)

      // If model wants to call tools
      if (hasTools && finishReason === 'tool_calls' && accToolCalls.length > 0) {
        await handleToolCalls(accToolCalls, apiMessages, sendSSE, toolCallsForFrontend)
        continue
      }

      // Final response
      if (toolCallsForFrontend.length > 0) {
        sendSSE({ type: 'tool_calls', calls: toolCallsForFrontend })
      }
      if (!apiUsage) {
        const promptText = apiMessages.map(m => typeof m.content === 'string' ? m.content : '').join('')
        apiUsage = {
          prompt_tokens: estimateTokens(promptText),
          completion_tokens: estimateTokens(accContent),
          total_tokens: estimateTokens(promptText) + estimateTokens(accContent),
          estimated: true,
        }
      }
      sendSSE({ type: 'done', usage: apiUsage })
      res.end()
      return
    } catch (err) {
      sendSSE({ type: 'content', content: `Error: ${err.message}` })
      sendSSE({ type: 'done' })
      res.end()
      return
    }
  }

  sendSSE({ type: 'content', content: '超过最大工具调用轮数' })
  sendSSE({ type: 'done' })
  res.end()
})

// ==================== Cron API ====================

app.get('/api/cron/jobs', (_req, res) => {
  res.json(getJobs())
})

app.post('/api/cron/jobs', (req, res) => {
  const job = addJob(req.body)
  res.json(job)
})

app.put('/api/cron/jobs/:id', (req, res) => {
  const job = updateJob(req.params.id, req.body)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json(job)
})

app.delete('/api/cron/jobs/:id', (req, res) => {
  deleteJob(req.params.id)
  res.json({ ok: true })
})

app.post('/api/cron/jobs/:id/run', (req, res) => {
  const result = runJobNow(req.params.id)
  if (!result) return res.status(404).json({ error: 'Job not found' })
  res.json(result)
})

app.get('/api/cron/results', (_req, res) => {
  res.json(getResults())
})

app.delete('/api/cron/results/:index', (req, res) => {
  const ok = deleteResult(parseInt(req.params.index))
  if (!ok) return res.status(404).json({ error: 'Result not found' })
  res.json({ ok: true })
})

app.delete('/api/cron/results', (_req, res) => {
  clearResults()
  res.json({ ok: true })
})

// ==================== File System API ====================

function buildFileTree(dirPath, depth = 0) {
  if (depth > 8) return []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const result = []

  // Sort: directories first, then files, both alphabetically
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of sorted) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue
    if (entry.name === 'node_modules' || entry.name === '__pycache__' || entry.name === '.git') continue

    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        expanded: false,
        children: buildFileTree(fullPath, depth + 1),
      })
    } else {
      result.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
      })
    }
  }

  return result
}

// System info API
app.get('/api/system/home', (_req, res) => {
  res.json({ home: os.homedir() })
})

// Browse directories: list subdirectories of a given path
app.get('/api/files/browse', (req, res) => {
  const dirPath = req.query.path
  if (!dirPath) return res.status(400).json({ error: 'No path' })
  if (!isPathAllowed(dirPath)) return res.status(403).json({ error: 'Access denied: path not allowed' })
  if (!fs.existsSync(dirPath)) {
    return res.status(400).json({ error: 'Invalid path' })
  }
  try {
    const stat = fs.statSync(dirPath)
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' })
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, path: path.join(dirPath, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const files = entries
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => ({ name: e.name, path: path.join(dirPath, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    res.json({
      current: dirPath,
      parent: path.dirname(dirPath) !== dirPath ? path.dirname(dirPath) : null,
      dirs,
      files,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/files/create', (req, res) => {
  const { path: parentPath, type, name } = req.body
  if (!parentPath || !type || !name) return res.status(400).json({ error: 'Missing fields' })
  if (!isPathAllowed(parentPath)) return res.status(403).json({ error: 'Path not allowed' })
  if (type !== 'file' && type !== 'folder') return res.status(400).json({ error: 'Invalid type' })
  // Basic name sanitization
  const safeName = name.replace(/[<>:"/\\|?*\x00]/g, '').trim()
  if (!safeName) return res.status(400).json({ error: 'Invalid name' })
  const fullPath = path.join(parentPath, safeName)
  if (fs.existsSync(fullPath)) return res.status(409).json({ error: 'Already exists' })
  try {
    if (type === 'folder') {
      fs.mkdirSync(fullPath, { recursive: true })
    } else {
      fs.writeFileSync(fullPath, '')
    }
    res.json({ success: true, path: fullPath })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/files/delete', (req, res) => {
  const { path: targetPath } = req.body
  if (!targetPath) return res.status(400).json({ error: 'No path' })
  if (!isPathAllowed(targetPath)) return res.status(403).json({ error: 'Path not allowed' })
  if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Path not found' })
  try {
    fs.rmSync(targetPath, { recursive: true, force: true })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/files/tree', (req, res) => {
  const { path: dirPath } = req.body
  if (!dirPath) return res.status(400).json({ error: 'No path' })
  if (!isPathAllowed(dirPath)) return res.status(403).json({ error: 'Access denied: path not allowed' })
  if (!fs.existsSync(dirPath)) {
    return res.status(400).json({ error: 'Invalid path' })
  }
  try {
    const tree = buildFileTree(dirPath)
    res.json(tree)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/files/content', (req, res) => {
  const { path: filePath } = req.body
  if (!filePath) return res.status(400).json({ error: 'No path' })
  if (!isPathAllowed(filePath)) return res.status(403).json({ error: 'Access denied: path not allowed' })
  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'File not found' })
  }
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (>1MB)' })
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    res.json({ content })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/files/save', (req, res) => {
  const { path: filePath, content } = req.body
  if (!filePath) return res.status(400).json({ error: 'No path' })
  if (!isPathAllowed(filePath)) return res.status(403).json({ error: 'Access denied: path not allowed' })
  try {
    fs.writeFileSync(filePath, content)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ==================== Content Search API ====================

app.post('/api/files/search', (req, res) => {
  const { path: dirPath, keyword } = req.body
  if (!dirPath || !keyword) return res.status(400).json({ error: 'Missing path or keyword' })
  if (!isPathAllowed(dirPath)) return res.status(403).json({ error: 'Access denied' })
  if (!fs.existsSync(dirPath)) return res.status(400).json({ error: 'Path not found' })
  try {
    const results = []
    const lower = keyword.toLowerCase()
    function walk(dir, depth) {
      if (depth > 5 || results.length >= 50) return
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue
        const full = path.join(dir, e.name)
        if (e.isDirectory()) { walk(full, depth + 1); continue }
        try {
          const content = fs.readFileSync(full, 'utf-8')
          if (content.toLowerCase().includes(lower)) {
            results.push({ path: full, name: e.name })
          }
        } catch {}
      }
    }
    walk(dirPath, 0)
    res.json(results.slice(0, 50))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ==================== RAG API ====================

import { getKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase, updateKnowledgeBaseConfig } from './ragEngine.js'

app.get('/api/rag/knowledge', (_req, res) => {
  res.json(getKnowledgeBases())
})

app.post('/api/rag/knowledge', async (req, res) => {
  const { name, filePaths, provider, model } = req.body
  if (!name || !filePaths?.length) return res.status(400).json({ error: 'Name and files required' })
  try {
    const config = loadConfig()
    // Validate all file paths are under home directory
    for (const fp of filePaths) {
      if (!isPathAllowed(fp)) return res.status(403).json({ error: `Access denied: ${fp}` })
    }
    const provId = provider || Object.keys(config.providers || {})[0]
    const prov = config.providers?.[provId]
    const result = await createKnowledgeBase(name, filePaths, {
      apiKey: prov?.apiKey || '',
      baseUrl: prov?.baseUrl || '',
      model: model || 'text-embedding-3-small',
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/rag/knowledge/:id', (req, res) => {
  deleteKnowledgeBase(req.params.id)
  res.json({ ok: true })
})

app.put('/api/rag/knowledge/:id', (req, res) => {
  updateKnowledgeBaseConfig(req.params.id, req.body)
  res.json({ ok: true })
})

// Initialize cron scheduler
initScheduler(loadConfig(), getAllMcpTools)
// Initialize MCP servers
initMcp()
// Set web search API key from config
const initialConfig = loadConfig()
if (initialConfig.webSearch?.apiKey) {
  setWebSearchKey(decrypt(initialConfig.webSearch.apiKey))
}
// Set API config getter for RAG
setApiConfigGetter(() => {
  const config = loadConfig()
  const firstProvider = Object.values(config.providers || {})[0]
  if (firstProvider?.apiKey) {
    return { apiKey: firstProvider.apiKey, baseUrl: firstProvider.baseUrl || '', model: 'text-embedding-3-small' }
  }
  return null
})

const server = http.createServer(app)
attachTerminal(server)

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
