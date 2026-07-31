
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAG_FILE = path.resolve(__dirname, '../rag_knowledge.json')
const SOURCES_DIR = path.resolve(__dirname, '../rag_sources')

// ==================== Storage ====================

function loadRag() {
  try {
    const raw = JSON.parse(fs.readFileSync(RAG_FILE, 'utf-8'))
    return raw.knowledgeBases || []
  } catch {
    return []
  }
}

function saveRag(kbs) {
  if (!fs.existsSync(SOURCES_DIR)) fs.mkdirSync(SOURCES_DIR, { recursive: true })
  fs.writeFileSync(RAG_FILE, JSON.stringify({ knowledgeBases: kbs }, null, 2))
}

// ==================== Embedding ====================

async function getEmbeddings(texts, config) {
  const { apiKey, baseUrl, model } = config
  if (!apiKey || !baseUrl) throw new Error('Missing API config for embedding')

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: model || 'text-embedding-3-small', input: texts }),
  })
  if (!res.ok) throw new Error(`Embedding API error: ${res.status}`)
  const data = await res.json()
  return data.data.map((d) => d.embedding)
}

// ==================== Processing ====================

function chunkText(text, maxLen = 500) {
  const chunks = []
  const paragraphs = text.split(/\n\n+/)
  let current = ''
  for (const p of paragraphs) {
    if ((current + p).length > maxLen && current.length > 0) {
      chunks.push(current.trim())
      current = p
    } else {
      current += (current ? '\n\n' : '') + p
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

// ==================== Similarity ====================

function cosineSimilarity(a, b) {
  let dot = 0, ma = 0, mb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    ma += a[i] * a[i]
    mb += b[i] * b[i]
  }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb) || 1)
}

// ==================== Public API ====================

export async function createKnowledgeBase(name, filePaths, apiConfig) {
  const kbs = loadRag()
  const id = `kb-${Date.now()}`

  const chunks = []
  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) continue
    const content = fs.readFileSync(fp, 'utf-8')
    const fileName = path.basename(fp)

    // Save source file
    const destPath = path.join(SOURCES_DIR, `${fileName}`)
    fs.copyFileSync(fp, destPath)

    const textChunks = chunkText(content)
    if (textChunks.length === 0) continue

    const embeddings = await getEmbeddings(textChunks, apiConfig)
    for (let i = 0; i < textChunks.length; i++) {
      chunks.push({
        id: `chunk-${Date.now()}-${i}`,
        text: textChunks[i],
        embedding: embeddings[i],
        source: fileName,
        chunkIndex: i,
      })
    }
  }

  const kb = {
    id,
    name,
    chunks,
    chatEnabled: true,
    codeEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  kbs.push(kb)
  saveRag(kbs)
  return { id, name, chunkCount: chunks.length }
}

export async function deleteKnowledgeBase(id) {
  let kbs = loadRag()
  kbs = kbs.filter((kb) => kb.id !== id)
  saveRag(kbs)
}

export function updateKnowledgeBaseConfig(id, updates) {
  const kbs = loadRag().map((kb) => (kb.id === id ? { ...kb, ...updates, updatedAt: new Date().toISOString() } : kb))
  saveRag(kbs)
}

export function searchKnowledge(query, apiConfig, kbId = null) {
  const kbs = loadRag()
  const targets = kbId ? kbs.filter((kb) => kb.id === kbId) : kbs
  const allChunks = []
  for (const kb of targets) {
    for (const c of kb.chunks) {
      allChunks.push({ ...c, kbName: kb.name, kbId: kb.id })
    }
  }
  // Simple keyword fallback when no API config (cheap search)
  if (!apiConfig?.apiKey) {
    const lower = query.toLowerCase()
    const results = allChunks
      .filter((c) => c.text.toLowerCase().includes(lower))
      .slice(0, 3)
    return results.length > 0 ? JSON.stringify(results.map((r) => ({
      kb: r.kbName,
      source: r.source,
      text: r.text.slice(0, 500),
    })), null, 2) : '未找到相关知识'
  }
  // Embedding-based search
  return getEmbeddings([query], apiConfig).then(([qEmb]) => {
    const scored = allChunks.map((c) => ({
      ...c,
      score: cosineSimilarity(qEmb, c.embedding),
    }))
    scored.sort((a, b) => b.score - a.score)
    return JSON.stringify(scored.slice(0, 3).map((r) => ({
      kb: r.kbName,
      source: r.source,
      score: r.score.toFixed(3),
      text: r.text.slice(0, 500),
    })), null, 2)
  })
}

export function getKnowledgeBases() {
  return loadRag().map((kb) => ({
    id: kb.id,
    name: kb.name,
    chunkCount: kb.chunks.length,
    chatEnabled: kb.chatEnabled,
    codeEnabled: kb.codeEnabled,
    createdAt: kb.createdAt,
    updatedAt: kb.updatedAt,
  }))
}

// Async wrapper for tool execution
export async function ragSearchTool(query, apiConfig, kbId = null) {
  return searchKnowledge(query, apiConfig, kbId)
}
