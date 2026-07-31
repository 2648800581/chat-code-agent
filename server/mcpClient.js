import { spawn } from 'child_process'

// Helper: send JSON-RPC request over stdout and read response
function rpcRequest(proc, method, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2)
    const request = JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n'
    proc.stdin.write(request)

    let buffer = ''
    const timer = setTimeout(() => {
      reject(new Error(`RPC timeout: ${method}`))
    }, timeoutMs)

    const onData = (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() // keep incomplete line in buffer
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          if (msg.id === id) {
            clearTimeout(timer)
            proc.stdout.removeListener('data', onData)
            if (msg.error) reject(new Error(msg.error.message || 'RPC error'))
            else resolve(msg.result)
            return
          }
        } catch { /* skip malformed lines */ }
      }
    }

    proc.stdout.on('data', onData)
    proc.on('error', (err) => { clearTimeout(timer); reject(err) })
    proc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer)
        proc.stdout.removeListener('data', onData)
        reject(new Error(`Process exited with code ${code}`))
      }
    })
  })
}

export class McpClient {
  constructor(config) {
    this.id = config.id
    this.name = config.name
    this.type = config.type // 'stdio' | 'http'
    this.command = config.command
    this.args = config.args || []
    this.url = config.url
    this.token = config.token || ''
    this.env = config.env || {}
    this.enabled = config.enabled ?? true
    this.tools = []
    this.connected = false
    this.error = null
    this._proc = null
  }

  async connect() {
    if (!this.enabled) return
    try {
      if (this.type === 'http') {
        await this.connectHttp()
      } else if (this.type === 'stdio') {
        await this.connectStdio()
      }
      this.connected = true
    } catch (err) {
      this.error = err.message
      this.connected = false
    }
  }

  async connectHttp() {
    const headers = { 'Content-Type': 'application/json' }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const res = await fetch(`${this.url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error.message || 'Unknown error')
    this._registerTools(data.result?.tools || [])
  }

  async connectStdio() {
    if (!this.command) throw new Error('stdio requires command')

    // Spawn the child process
    const env = { ...process.env, ...this.env }
    this._proc = spawn(this.command, this.args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this._proc.on('error', (err) => {
      this.error = err.message
      this.connected = false
    })

    this._proc.stderr.on('data', (chunk) => {
      // Log stderr but don't treat as fatal
    })

    // MCP initialize
    const initResult = await rpcRequest(this._proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'chat-code-agent', version: '1.0.0' },
    }, 15000)

    // Send initialized notification
    this._proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

    // Discover tools
    const toolsResult = await rpcRequest(this._proc, 'tools/list', {}, 10000)
    this._registerTools(toolsResult.tools || [])
  }

  _registerTools(tools) {
    this.tools = tools.map((t) => ({
      ...t,
      name: `mcp_${this.id}_${t.name.replace(/[-.]/g, '_')}`,
      description: `[${this.name}] ${t.description || t.name}`,
      _originalName: t.name,
    }))
  }

  async callTool(toolName, args) {
    if (!this.connected) throw new Error(`MCP Server ${this.name} not connected`)
    const tool = this.tools.find((t) => t.name === toolName)
    if (!tool?._originalName) throw new Error(`Tool ${toolName} not found`)

    if (this.type === 'http') {
      return this.callToolHttp(tool._originalName, args)
    }
    if (this.type === 'stdio') {
      return this.callToolStdio(tool._originalName, args)
    }
    throw new Error(`Unsupported transport: ${this.type}`)
  }

  async callToolHttp(toolName, args) {
    const headers = { 'Content-Type': 'application/json' }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const res = await fetch(`${this.url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: toolName, arguments: args || {} }, id: 2 }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error.message || 'Unknown error')
    return data.result
  }

  async callToolStdio(toolName, args) {
    const result = await rpcRequest(this._proc, 'tools/call', { name: toolName, arguments: args || {} }, 30000)
    // Return content from MCP result
    if (result.content) {
      return result.content.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n')
    }
    return JSON.stringify(result)
  }

  getToolDefinitions() {
    return this.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema || { type: 'object', properties: {} },
      },
    }))
  }

  disconnect() {
    if (this._proc) {
      try { this._proc.kill() } catch {}
      this._proc = null
    }
    this.connected = false
  }
}
