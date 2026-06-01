import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { readMemories } from '@/lib/claude-reader'

export const dynamic = 'force-dynamic'

const CLAUDE_DIR = path.join(os.homedir(), '.claude')

export async function GET() {
  const memories = await readMemories()
  return NextResponse.json({ memories })
}

export async function PATCH(req: Request) {
  try {
    const { projectSlug, file, content } = await req.json() as {
      projectSlug?: string
      file?: string
      content?: string
    }

    if (!projectSlug || !file || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Only allow .md files
    if (!file.endsWith('.md')) {
      return NextResponse.json({ error: 'Only .md files allowed' }, { status: 400 })
    }

    // Prevent path traversal — use whitelist approach for safe characters only
    // Only allow alphanumeric, underscore, dash, and dot in project slug
    if (!/^[a-zA-Z0-9_.-]+$/.test(projectSlug)) {
      return NextResponse.json({ error: 'Invalid project slug' }, { status: 400 })
    }

    // Only allow alphanumeric, underscore, dash, dot in filename, must end with .md
    if (!/^[a-zA-Z0-9_.-]+\.md$/.test(file)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    // Use path.resolve to normalize and resolve any .. or symlinks
    const filePath = path.resolve(path.join(CLAUDE_DIR, 'projects', projectSlug, 'memory', file))
    const allowedRoot = path.resolve(path.join(CLAUDE_DIR, 'projects'))

    // Ensure the normalized path stays within ~/.claude/projects/
    if (!filePath.startsWith(allowedRoot + path.sep)) {
      return NextResponse.json({ error: 'Path outside allowed directory' }, { status: 403 })
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[memory] Failed to write file:', err)
    return NextResponse.json({ error: 'Failed to save memory file' }, { status: 500 })
  }
}
