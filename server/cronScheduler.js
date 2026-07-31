import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import { loadSkills } from './skillsStore.js'
import { CODE_TOOLS, executeTool } from './tools.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JOBS_FILE = path.resolve(__dirname, '../cron_jobs.json')
const RESULTS_FILE = path.resolve(__dirname, '../cron_results.json')
let _getMcpDefs = null

// ==================== Persistence ====================

function loadJobs() {
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveJobs(jobs) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2))
}

function loadResults() {
  try {
    return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveResult(result) {
  const results = loadResults()
  results.unshift(result) // newest first
  if (results.length > 100) results.length = 100
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))
}

// ==================== Model Execution ====================

async function executeJob(job, config, allSkills, getMcpDefs) {
  const providerConfig = config.providers?.[job.provider]
  if (!providerConfig?.apiKey) {
    return { success: false, error: `Provider ${job.provider} not configured` }
  }

  const { apiKey, baseUrl } = providerConfig
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }

  // Build system message with available skills
  let systemContent = '你是一个定时任务执行助手。请根据用户的 prompt 执行任务并返回结果。'
  const selectedSkills = (job.skillIds || []).map(id => allSkills.find(s => s.id === id)).filter(Boolean)
  if (selectedSkills.length > 0) {
    const list = selectedSkills.map(s => `${s.name} - ${s.description}`).join(', ')
    systemContent += `\n\n可用 Skills: ${list}`
    systemContent += '\n若用户意图与某个 Skill 相关，务必先调用 load_skill 工具获取完整指令再回答；否则忽略。'
  }

  // Resolve tools (auto-include load_skill when skills are selected)
  const toolNames = job.toolNames || []
  const resolvedToolNames = selectedSkills.length > 0 && !toolNames.includes('load_skill')
    ? [...toolNames, 'load_skill']
    : toolNames
  const allDefs = getMcpDefs ? [...CODE_TOOLS, ...getMcpDefs()] : CODE_TOOLS
  const tools = resolvedToolNames.length > 0
    ? allDefs.filter(t => resolvedToolNames.includes(t.function.name))
    : []
  const hasTools = tools.length > 0

  const apiMessages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: job.prompt },
  ]

  const maxRounds = hasTools ? ((config.modelParams || {}).maxToolRounds || 10) : 1

  for (let round = 0; round < maxRounds; round++) {
    try {
      const body = { model: job.model, messages: apiMessages, stream: false, ...(config.modelParams || {}) }
      if (hasTools) body.tools = tools

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errText = await response.text()
        return { success: false, error: `API Error (${response.status}): ${errText.slice(0, 200)}` }
      }

      const data = await response.json()
      const msg = data.choices?.[0]?.message
      const finishReason = data.choices?.[0]?.finish_reason

      if (hasTools && finishReason === 'tool_calls' && msg?.tool_calls?.length > 0) {
        apiMessages.push(msg)
        for (const tc of msg.tool_calls) {
          let args = {}
          try { args = JSON.parse(tc.function.arguments || '{}') } catch {}
          const result = await executeTool(tc.function.name, args)
          apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result })
        }
        continue
      }

      const content = msg?.content || ''
      return { success: true, content, usage: data.usage }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  return { success: false, error: '超过最大工具调用轮数' }
}

// ==================== Scheduler ====================

const scheduledTasks = new Map()
let appConfig = null

function loadConfig() {
  try {
    const configPath = path.resolve(__dirname, '../config.json')
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {
    return { providers: {} }
  }
}

function scheduleJob(job) {
  if (scheduledTasks.has(job.id)) {
    scheduledTasks.get(job.id).stop()
    scheduledTasks.delete(job.id)
  }

  if (!job.enabled) return

  if (!cron.validate(job.schedule)) {
    console.error(`[cron] Invalid schedule for job ${job.id}: ${job.schedule}`)
    return
  }

  const task = cron.schedule(job.schedule, async () => {
    console.log(`[cron] Executing job: ${job.name} (${job.id})`)
    const config = appConfig || loadConfig()
    const allSkills = loadSkills()
    const startTime = Date.now()

    const result = await executeJob(job, config, allSkills, _getMcpDefs)
    const duration = Date.now() - startTime

    const record = {
      jobId: job.id,
      jobName: job.name,
      timestamp: new Date().toISOString(),
      duration,
      ...result,
    }

    saveResult(record)
    console.log(`[cron] Job ${job.name} completed in ${duration}ms, success: ${result.success}`)
  })

  scheduledTasks.set(job.id, task)
  console.log(`[cron] Scheduled job: ${job.name} (${job.schedule})`)
}

export function initScheduler(config, getMcpDefs) {
  appConfig = config
  if (getMcpDefs) _getMcpDefs = getMcpDefs
  const jobs = loadJobs()
  for (const job of jobs) {
    if (job.enabled) {
      scheduleJob(job)
    }
  }
  console.log(`[cron] Scheduler initialized with ${jobs.filter(j => j.enabled).length} active jobs`)
}

// ==================== API ====================

export function getJobs() {
  return loadJobs()
}

export function addJob(jobData) {
  const jobs = loadJobs()
  const job = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: jobData.name,
    prompt: jobData.prompt,
    schedule: jobData.schedule,
    enabled: jobData.enabled !== false,
    model: jobData.model || 'gpt-4o',
    provider: jobData.provider || 'openai',
    skillIds: jobData.skillIds || [],
    toolNames: jobData.toolNames || [],
    createdAt: Date.now(),
  }
  jobs.push(job)
  saveJobs(jobs)
  if (job.enabled) scheduleJob(job)
  return job
}

export function updateJob(id, updates) {
  const jobs = loadJobs()
  const idx = jobs.findIndex((j) => j.id === id)
  if (idx === -1) return null
  Object.assign(jobs[idx], updates)
  saveJobs(jobs)
  scheduleJob(jobs[idx])
  return jobs[idx]
}

export function deleteJob(id) {
  let jobs = loadJobs()
  jobs = jobs.filter((j) => j.id !== id)
  saveJobs(jobs)
  if (scheduledTasks.has(id)) {
    scheduledTasks.get(id).stop()
    scheduledTasks.delete(id)
  }
  return true
}

export function getResults() {
  return loadResults()
}

export function deleteResult(index) {
  const results = loadResults()
  if (index < 0 || index >= results.length) return false
  results.splice(index, 1)
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))
  return true
}

export function clearResults() {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify([], null, 2))
  return true
}

export function runJobNow(id) {
  const jobs = loadJobs()
  const job = jobs.find((j) => j.id === id)
  if (!job) return null

  const config = appConfig || loadConfig()
  const allSkills = loadSkills()

  executeJob(job, config, allSkills, _getMcpDefs).then((result) => {
    const record = {
      jobId: job.id,
      jobName: job.name,
      timestamp: new Date().toISOString(),
      duration: 0,
      triggered: 'manual',
      ...result,
    }
    saveResult(record)
    console.log(`[cron] Manual run of ${job.name}: success=${result.success}`)
  })

  return { status: 'triggered', job }
}
