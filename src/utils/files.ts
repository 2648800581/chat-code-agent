export interface AttachedFile {
  name: string
  type: string
  content: string // text content or base64 data URL
}

export async function readAttachedFiles(files: File[]): Promise<AttachedFile[]> {
  const results: AttachedFile[] = []
  for (const file of files) {
    try {
      if (file.type.startsWith('image/')) {
        const dataUrl = await readFileAsDataURL(file)
        results.push({ name: file.name, type: file.type, content: dataUrl })
      } else if (isTextFile(file)) {
        const text = await readFileAsText(file)
        results.push({ name: file.name, type: file.type, content: text })
      } else {
        // Try to read as text, fall back to data URL
        try {
          const text = await readFileAsText(file)
          results.push({ name: file.name, type: file.type, content: text })
        } catch {
          const dataUrl = await readFileAsDataURL(file)
          results.push({ name: file.name, type: file.type, content: dataUrl })
        }
      }
    } catch {
      results.push({ name: file.name, type: file.type, content: '[读取失败]' })
    }
  }
  return results
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function isTextFile(file: File): boolean {
  const textExts = ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go', '.c', '.cpp', '.h', '.hpp', '.java', '.rb', '.php', '.sql', '.css', '.html', '.xml', '.yaml', '.yml', '.toml', '.sh', '.bash', '.env', '.gitignore', '.csv', '.log', '.cfg', '.ini', '.conf']
  const name = file.name.toLowerCase()
  return textExts.some((ext) => name.endsWith(ext)) || file.type.startsWith('text/')
}

export function buildApiMessages(
  userText: string,
  files: AttachedFile[],
  conversationMessages: { role: string; content: string }[]
): { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }[] {
  const messages: { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }[] = []

  // Add conversation history (all text)
  for (const msg of conversationMessages) {
    messages.push({ role: msg.role, content: msg.content })
  }

  if (files.length === 0) {
    messages.push({ role: 'user', content: userText })
    return messages
  }

  // Build multi-modal content
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

  // Add text files as inline text
  const textFiles = files.filter((f) => !f.type.startsWith('image/'))
  const imageFiles = files.filter((f) => f.type.startsWith('image/'))

  if (textFiles.length > 0) {
    let fileContext = ''
    for (const f of textFiles) {
      fileContext += `\n\n--- 附件: ${f.name} ---\n${f.content}`
    }
    content.push({ type: 'text', text: userText + fileContext })
  } else {
    content.push({ type: 'text', text: userText })
  }

  // Add images as image_url
  for (const f of imageFiles) {
    content.push({ type: 'image_url', image_url: { url: f.content } })
  }

  messages.push({ role: 'user', content })
  return messages
}
