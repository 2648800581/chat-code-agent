import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKILLS_FILE = path.resolve(__dirname, '../skills.json')

// Web search API key (set from server/index.js)
let _webSearchKey = ''
let _getApiConfig = null

export function setWebSearchKey(key) {
  _webSearchKey = key || ''
}

export function setApiConfigGetter(fn) {
  _getApiConfig = fn
}

// 路径安全验证：限制操作范围在用户 home 目录内
export function isPathAllowed(targetPath) {
  if (!targetPath) return false
  const resolved = path.resolve(targetPath)
  const homeDir = os.homedir()
  return resolved === homeDir || resolved.startsWith(homeDir + path.sep)
}

export const CODE_TOOLS = [
  { type: 'function', function: { name: 'list_files', description: '列出指定目录下的文件和子目录', parameters: { type: 'object', properties: { path: { type: 'string', description: '要列出的目录绝对路径' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'read_file', description: '读取指定文件的完整内容', parameters: { type: 'object', properties: { path: { type: 'string', description: '要读取的文件绝对路径' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: '创建或覆盖文件内容', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件绝对路径' }, content: { type: 'string', description: '要写入的文件内容' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'delete_file', description: '删除指定文件或文件夹（文件夹会被递归删除）', parameters: { type: 'object', properties: { path: { type: 'string', description: '要删除的文件或文件夹绝对路径' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'create_folder', description: '创建新文件夹（自动创建所需的父目录）', parameters: { type: 'object', properties: { path: { type: 'string', description: '要创建的文件夹绝对路径' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'execute_command', description: '在终端执行 shell 命令并返回输出', parameters: { type: 'object', properties: { command: { type: 'string', description: '要执行的 shell 命令' }, workdir: { type: 'string', description: '工作目录（可选，默认为项目目录）' } }, required: ['command'] } } },
  { type: 'function', function: { name: 'load_skill', description: '加载指定 Skill 的完整指令内容。当用户输入与某个可用 Skill 相关时调用。', parameters: { type: 'object', properties: { name: { type: 'string', description: 'Skill 名称' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'search_files', description: '在项目中搜索包含指定关键词的文件', parameters: { type: 'object', properties: { path: { type: 'string', description: '搜索的根目录路径' }, keyword: { type: 'string', description: '要搜索的关键词' } }, required: ['path', 'keyword'] } } },
  { type: 'function', function: { name: 'git_status', description: '查看 Git 工作区状态（哪些文件被修改/新增/删除）', parameters: { type: 'object', properties: { workdir: { type: 'string', description: '项目根目录' } }, required: ['workdir'] } } },
  { type: 'function', function: { name: 'git_diff', description: '查看文件的具体改动内容（未暂存或已暂存）', parameters: { type: 'object', properties: { workdir: { type: 'string', description: '项目根目录' }, staged: { type: 'boolean', description: '是否查看已暂存的改动，默认 false' } }, required: ['workdir'] } } },
  { type: 'function', function: { name: 'git_log', description: '查看 Git 提交历史', parameters: { type: 'object', properties: { workdir: { type: 'string', description: '项目根目录' }, count: { type: 'number', description: '返回的提交数量，默认 10' } }, required: ['workdir'] } } },
  { type: 'function', function: { name: 'get_time', description: '获取当前的日期和时间，包括年月日、时分秒、星期', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'web_search', description: '使用 Bing 搜索引擎搜索网页内容，返回标题、链接和摘要（国内网络可用）', parameters: { type: 'object', properties: { query: { type: 'string', description: '搜索关键词' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'web_tavily_search', description: '使用 Tavily AI 搜索 API 进行高质量网页搜索，返回标题、链接、内容和相关度评分。适合获取实时信息、新闻、天气等', parameters: { type: 'object', properties: { query: { type: 'string', description: '搜索关键词，英文效果更好' }, depth: { type: 'string', description: '搜索深度: basic 或 advanced，默认 basic' }, max_results: { type: 'number', description: '返回结果数: 1-10，默认 5' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'rag_search', description: '搜索本地 RAG 知识库，从用户上传的文档中查找相关信息。当用户问关于内部文档、技术手册、公司制度等问题时使用', parameters: { type: 'object', properties: { query: { type: 'string', description: '搜索查询' }, kb_id: { type: 'string', description: '指定知识库 ID（可选，不填则搜索全部）' } }, required: ['query'] } } },
]

export async function executeTool(name, args) {
  try {
    if (name === 'list_files') {
      const dirPath = args.path
      if (!dirPath) return '缺少 path 参数'
      if (!isPathAllowed(dirPath)) return '访问被拒绝：路径超出允许范围'
      if (!fs.existsSync(dirPath)) return '路径不存在'
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '__pycache__')
        .map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
        .join('\n')
    }
    if (name === 'read_file') {
      const filePath = args.path
      if (!filePath) return '缺少 path 参数'
      if (!isPathAllowed(filePath)) return '访问被拒绝：路径超出允许范围'
      if (!fs.existsSync(filePath)) return '文件不存在'
      const stat = fs.statSync(filePath)
      if (stat.size > 500000) return '文件过大 (>500KB)，请指定具体范围'
      return fs.readFileSync(filePath, 'utf-8')
    }
    if (name === 'search_files') {
      const dirPath = args.path || '.'
      const keyword = args.keyword
      if (!isPathAllowed(dirPath)) return '访问被拒绝：路径超出允许范围'
      if (!fs.existsSync(dirPath)) return '路径不存在'
      const results = []
      function walk(dir, depth) {
        if (depth > 5) return
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue
          const full = path.join(dir, e.name)
          if (e.isDirectory()) { walk(full, depth + 1); continue }
          try {
            const content = fs.readFileSync(full, 'utf-8')
            if (content.includes(keyword)) {
              const lines = content.split('\n')
              const matches = lines.map((l, i) => ({ line: i + 1, text: l }))
                .filter(l => l.text.includes(keyword))
                .slice(0, 3)
              results.push(`${full}: ${matches.map(m => `L${m.line}`).join(', ')}`)
            }
          } catch {}
        }
      }
      walk(dirPath, 0)
      return results.length > 0 ? results.slice(0, 20).join('\n') : '未找到匹配内容'
    }
    if (name === 'write_file') {
      const filePath = args.path
      const content = args.content
      if (!filePath) return '缺少 path 参数'
      if (!isPathAllowed(filePath)) return '访问被拒绝：路径超出允许范围'
      if (content === undefined || content === null) return '缺少 content 参数'
      if (content.length > 500000) return '文件过大 (>500KB)，请分段写入'
      fs.writeFileSync(filePath, content)
      return `文件写入成功: ${filePath} (${content.length} 字符)`
    }
    if (name === 'delete_file') {
      const filePath = args.path
      if (!filePath) return '缺少 path 参数'
      if (!isPathAllowed(filePath)) return '访问被拒绝：路径超出允许范围'
      if (!fs.existsSync(filePath)) return '路径不存在'
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true })
        return `文件夹删除成功: ${filePath}`
      }
      fs.unlinkSync(filePath)
      return `文件删除成功: ${filePath}`
    }
    if (name === 'create_folder') {
      const dirPath = args.path
      if (!dirPath) return '缺少 path 参数'
      if (!isPathAllowed(dirPath)) return '访问被拒绝：路径超出允许范围'
      if (fs.existsSync(dirPath)) return '路径已存在'
      fs.mkdirSync(dirPath, { recursive: true })
      return `文件夹创建成功: ${dirPath}`
    }
    if (name === 'execute_command') {
      const command = args.command
      const workdir = args.workdir
      if (!command) return '缺少 command 参数'
      if (workdir && !isPathAllowed(workdir)) return '访问被拒绝：工作目录超出允许范围'
      try {
        const output = execSync(command, {
          timeout: 30000,
          maxBuffer: 100 * 1024,
          encoding: 'utf-8',
          cwd: workdir || undefined,
        })
        const trimmed = output.length > 50000 ? output.slice(0, 50000) + '\n...(输出超过 50KB，已截断)' : output
        return trimmed
      } catch (err) {
        return `命令执行失败: ${err.message}${err.stdout ? '\n输出: ' + err.stdout.slice(0, 5000) : ''}`
      }
    }
    if (name === 'load_skill') {
      const skillName = args.name
      if (!skillName) return '缺少 name 参数'
      try {
        const skills = JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf-8'))
        // 先精确匹配，再模糊匹配
        let skill = skills.find(s => s.name === skillName)
        if (!skill) {
          skill = skills.find(s => s.name.includes(skillName) || skillName.includes(s.name))
        }
        if (!skill) return `未找到 Skill: "${skillName}"，可用: ${skills.map(s => s.name).join(', ')}`
        return `Skill "${skill.name}":\n${skill.content}`
      } catch (err) {
        return `加载 Skill 失败: ${err.message}`
      }
    }
    if (name === 'git_status') {
      const workdir = args.workdir
      if (!workdir) return '缺少 workdir 参数'
      if (!isPathAllowed(workdir)) return '访问被拒绝'
      try {
        return execSync('git status --short', { timeout: 10000, maxBuffer: 50 * 1024, encoding: 'utf-8', cwd: workdir }).trim()
      } catch (err) {
        return `Git 命令失败: ${err.message}`
      }
    }
    if (name === 'git_diff') {
      const workdir = args.workdir
      if (!workdir) return '缺少 workdir 参数'
      if (!isPathAllowed(workdir)) return '访问被拒绝'
      try {
        const cmd = args.staged ? 'git diff --staged' : 'git diff'
        const output = execSync(cmd, { timeout: 10000, maxBuffer: 50 * 1024, encoding: 'utf-8', cwd: workdir })
        const trimmed = output.length > 50000 ? output.slice(0, 50000) + '\n...(输出超过 50KB，已截断)' : output
        return trimmed || '没有改动'
      } catch (err) {
        return `Git 命令失败: ${err.message}`
      }
    }
    if (name === 'git_log') {
      const workdir = args.workdir
      if (!workdir) return '缺少 workdir 参数'
      if (!isPathAllowed(workdir)) return '访问被拒绝'
      try {
        const count = args.count || 10
        return execSync(`git log --oneline -n ${count}`, { timeout: 10000, maxBuffer: 50 * 1024, encoding: 'utf-8', cwd: workdir }).trim()
      } catch (err) {
        return `Git 命令失败: ${err.message}`
      }
    }
    if (name === 'get_time') {
      return new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'long', hour12: false })
    }
    if (name === 'web_search') {
      const query = args.query
      if (!query) return '缺少 query 参数'
      try {
        const q = encodeURIComponent(query)
        const cmd = `curl -sL "https://cn.bing.com/search?q=${q}&count=5" -H "User-Agent: Mozilla/5.0" --max-time 10`
        const html = execSync(cmd, { timeout: 12000, maxBuffer: 200 * 1024, encoding: 'utf-8' })
        const results = []
        // Bing search result parsing
        const resultRegex = /<li class="b_algo"[^>]*>[\s\S]*?<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi
        let match
        while ((match = resultRegex.exec(html)) && results.length < 5) {
          results.push({
            title: match[2].replace(/<[^>]+>/g, ''),
            url: match[1],
            snippet: match[3].replace(/<[^>]+>/g, '').trim().slice(0, 200),
          })
        }
        return results.length > 0 ? JSON.stringify(results, null, 2) : '未找到搜索结果'
      } catch (err) {
        return `搜索失败: ${err.message}`
      }
    }
    if (name === 'web_extract') {
      const url = args.url
      if (!url) return '缺少 url 参数'
      try {
        const proxy = process.env.ALL_PROXY || 'socks5://127.0.0.1:7897'
        const cmd = `curl -sL --socks5-hostname "${proxy.replace('socks5://', '')}" -A "Mozilla/5.0" --max-time 15 "${url}"`
        const html = execSync(cmd, { timeout: 18000, maxBuffer: 500 * 1024, encoding: 'utf-8' })
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#\d+;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        return text.slice(0, 5000) || '无法提取网页内容'
      } catch (err) {
        return `提取失败: ${err.message}`
      }
    }
    if (name === 'web_tavily_search') {
      const query = args.query
      if (!query) return '缺少 query 参数'
      const depth = args.depth || 'basic'
      const maxResults = Math.min(args.max_results || 5, 10)
      if (!_webSearchKey) return '网页搜索功能未配置，请在设置中填入 Tavily API Key'
      try {
        const body = JSON.stringify({ api_key: _webSearchKey, query, search_depth: depth, max_results: maxResults, include_answer: true })
        const cmd = `curl -s -X POST "https://api.tavily.com/search" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}' --max-time 20`
        const output = execSync(cmd, { timeout: 25000, maxBuffer: 500 * 1024, encoding: 'utf-8' })
        const data = JSON.parse(output)
        if (data.error) return `Tavily 错误: ${data.error}`
        const results = []
        if (data.answer) results.push({ type: 'answer', content: data.answer })
        for (const r of (data.results || []).slice(0, maxResults)) {
          results.push({
            title: r.title,
            url: r.url,
            content: r.content,
            score: r.score,
            published_date: r.published_date || '',
          })
        }
        return JSON.stringify(results, null, 2)
      } catch (err) {
        return `Tavily 搜索失败: ${err.message}`
      }
    }
    if (name === 'rag_search') {
      const query = args.query
      if (!query) return '缺少 query 参数'
      try {
        const { ragSearchTool } = await import('./ragEngine.js')
        const apiConfig = _getApiConfig ? _getApiConfig() : null
        return await ragSearchTool(query, apiConfig, args.kb_id)
      } catch (err) {
        return `RAG 搜索失败: ${err.message}`
      }
    }
    return '未知工具'
  } catch (err) {
    return `工具执行错误: ${err.message}`
  }
}
