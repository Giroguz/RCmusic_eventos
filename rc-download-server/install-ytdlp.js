import { chmod, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const targetDir = path.join(process.cwd(), 'bin')
const target = path.join(targetDir, 'yt-dlp')
const response = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp')
if (!response.ok) throw new Error(`yt-dlp download failed: ${response.status}`)
await mkdir(targetDir, { recursive: true })
await writeFile(target, Buffer.from(await response.arrayBuffer()))
await chmod(target, 0o755)
console.log('yt-dlp ready')
