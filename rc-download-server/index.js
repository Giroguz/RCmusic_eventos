import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const app = express()
const port = Number(process.env.PORT || 8787)
const corsOrigin = process.env.CORS_ORIGIN || '*'
let tokenCache = { value: '', expiresAt: 0 }

app.use(cors({ origin: corsOrigin }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'rc-music-eventos-api' })
})

async function getSpotifyToken() {
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.value
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Spotify no está configurado en el servidor')

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) throw new Error('No se pudo autenticar con Spotify')
  const data = await response.json()
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  }
  return tokenCache.value
}

app.get('/api/spotify-search', async (req, res) => {
  const query = String(req.query.q || '').trim()
  if (!query) return res.status(400).json({ error: 'Falta la búsqueda' })

  try {
    const token = await getSpotifyToken()
    const params = new URLSearchParams({ q: query, type: 'track', limit: '8', market: 'PE' })
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return res.status(response.status).json({ error: 'Spotify no respondió' })
    const data = await response.json()
    const tracks = (data.tracks?.items || []).map((track) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(', '),
      duration: `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}`,
      thumbnail: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || '',
    }))
    return res.json({ tracks })
  } catch (error) {
    return res.status(503).json({ error: error.message })
  }
})

app.post('/api/youtube-download', async (req, res) => {
  const videoId = String(req.body?.videoId || '')
  const format = req.body?.format === 'm4a' ? 'm4a' : 'mp3'
  // Accept only a YouTube video id; never pass arbitrary URLs to the downloader.
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return res.status(400).json({ error: 'ID de YouTube inválido' })

  const executable = process.env.YTDLP_PATH || path.join(process.cwd(), 'bin', 'yt-dlp')
  const source = `https://www.youtube.com/watch?v=${videoId}`
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rc-youtube-'))
  const outputBase = path.join(directory, 'audio')
  const args = ['--no-playlist', '--no-warnings', '-x', '--audio-format', format, '--audio-quality', '0', '-o', `${outputBase}.%(ext)s`, source]
  const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  let errorText = ''
  child.stderr.on('data', (chunk) => { errorText += String(chunk).slice(-2000) })

  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
    if (code !== 0) throw new Error(errorText || 'No se pudo preparar el audio')
    const files = await readdir(directory)
    const file = files.find((name) => name.endsWith(`.${format}`))
    if (!file) throw new Error('El archivo de audio no fue generado')
    const filePath = path.join(directory, file)
    const info = await stat(filePath)
    res.status(200).set({ 'Content-Type': format === 'm4a' ? 'audio/mp4' : 'audio/mpeg', 'Content-Length': String(info.size), 'Content-Disposition': `attachment; filename="youtube-${videoId}.${format}"`, 'Cache-Control': 'no-store' })
    createReadStream(filePath).pipe(res)
    res.once('finish', () => rm(directory, { recursive: true, force: true }).catch(() => {}))
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
    if (!res.headersSent) res.status(502).json({ error: 'No se pudo preparar el audio' })
    console.error(error.message)
  }
  req.once('close', () => { if (!res.writableEnded) child.kill('SIGTERM') })
})

app.listen(port, () => {
  console.log(`RC music_eventos API escuchando en el puerto ${port}`)
})
