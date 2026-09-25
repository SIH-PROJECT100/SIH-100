import fs from 'node:fs'
import path from 'node:path'

const BANNED_PATTERNS = [
  { pattern: /bg-gradient-to-[rltb]/i, name: 'Gradient backgrounds/text' },
  { pattern: /bg-clip-text/i, name: 'Text clipping gradients' },
  { pattern: /hover:-translate-y-/i, name: 'Hover lift / 3D jump' },
  { pattern: /hover:scale-/i, name: 'Hover scaling jump' },
  { pattern: /ai-powered|next-gen intelligent/i, name: 'AI marketing buzzwords' },
  { pattern: /[✨🚀🛡️🤖🔥🎉]/u, name: 'Consumer emojis in UI' },
]

const SRC_DIR = path.resolve(import.meta.dirname, '../src')

let hasErrors = false

function walk(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true })
  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    if (file.isDirectory()) {
      walk(fullPath)
    } else if (/\.(tsx|ts|css|html)$/.test(file.name)) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        // Skip comment lines in check script itself
        for (const { pattern, name } of BANNED_PATTERNS) {
          if (pattern.test(line)) {
            console.error(`❌ Banned pattern [${name}] in ${path.relative(process.cwd(), fullPath)}:${idx + 1}`)
            console.error(`   Line: ${line.trim()}`)
            hasErrors = true
          }
        }
      })
    }
  }
}

console.log('🔍 Checking codebase for banned vibe code patterns...')
walk(SRC_DIR)

if (hasErrors) {
  console.error('\n❌ Banned vibe code patterns found! Fix them before proceeding.')
  process.exit(1)
} else {
  console.log('✅ Clean! No banned vibe code patterns detected.')
}
