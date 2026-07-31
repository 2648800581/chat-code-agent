import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKILLS_FILE = path.resolve(__dirname, '../skills.json')

export function loadSkills() {
  try {
    return JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveSkills(skills) {
  fs.writeFileSync(SKILLS_FILE, JSON.stringify(skills, null, 2))
}
