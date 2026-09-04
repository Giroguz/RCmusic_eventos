import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const app = express()
const port = Number(process.env.PORT || 8787)
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'https://r-cmusic-eventos.vercel.app'
const corsOrigin = process.env.CORS_ORIGIN || frontendOrigin
const driveFolderId = process.env.DRIVE_FOLDER_ID || '1UTIQESYvJcNdKXNsDdDs0dRCrDzs5JvF'
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://rcmusic-eventos.onrender.com/api/drive/callback'
const driveTokenCache = new Map()
let spotifyTokenCache = { value: '', expiresAt: 0 }
const driveCatalogCache = new Map()
const oauthStates = new Map()
const driveSessions = new Map()
const driveSessionTtl = 60 * 60 * 24 * 30 * 1000
const driveCookieKey = crypto.createHash('sha256').update(process.env.DRIVE_SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'rc-drive-session').digest()

app.use(cors({ origin: corsOrigin, credentials: true }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'rc-music-eventos-api' })
})

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=')
    if (index < 0) return ['', '']
    return [decodeURIComponent(part.slice(0, index).trim()), decodeURIComponent(part.slice(index + 1).trim())]
  }).filter(([key, value]) => key && value))
}

function cookie(name, value, maxAge = 60 * 60 * 24 * 30) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=None`
}

function encryptDriveRefreshToken(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', driveCookieKey, iv)
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url')
}

function decryptDriveRefreshToken(value) {
  try {
    const raw = Buffer.from(String(value || ''), 'base64url')
    if (raw.length < 29) return ''
    const iv = raw.subarray(0, 12)
    const authTag = raw.subarray(12, 28)
    const ciphertext = raw.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', driveCookieKey, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch { return '' }
}

function redirectWithDriveSession(returnTo, sessionId) {
  const target = new URL(safeReturnTo(returnTo))
  target.searchParams.set('drive', 'connected')
  target.searchParams.set('drive_session', sessionId)
  return target.toString()
}

function safeReturnTo(value) {
  return String(value || frontendOrigin).startsWith(frontendOrigin) ? String(value || frontendOrigin) : frontendOrigin
}

app.get('/api/drive/auth', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ error: 'Google Drive no está configurado' })
  const state = crypto.randomBytes(24).toString('hex')
  oauthStates.set(state, safeReturnTo(req.query.returnTo))
  setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000)
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: googleRedirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/drive.readonly', state })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

app.get('/api/drive/callback', async (req, res) => {
  const returnTo = oauthStates.get(String(req.query.state || '')) || frontendOrigin
  oauthStates.delete(String(req.query.state || ''))
  if (req.query.error) return res.redirect(`${safeReturnTo(returnTo)}?drive=denied`)
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: String(req.query.code || ''), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: googleRedirectUri, grant_type: 'authorization_code' }) })
    const data = await response.json()
    if (!response.ok || !data.refresh_token) throw new Error('No se obtuvo autorización de Google Drive')
    // The session token is opaque and encrypted, so it remains valid if the next request reaches another Render instance.     const sessionId = encryptDriveRefreshToken(data.refresh_token)
    driveSessions.set(sessionId, { refreshToken: data.refresh_token, expiresAt: Date.now() + driveSessionTtl })
    setTimeout(() => driveSessions.delete(sessionId), driveSessionTtl)
    res.setHeader('Set-Cookie', cookie('drive_refresh_token', encryptDriveRefreshToken(data.refresh_token)))
    driveCatalogCache.clear()
    res.redirect(redirectWithDriveSession(returnTo, sessionId))
  } catch (error) {
    console.error(error.message)
    res.redirect(`${safeReturnTo(returnTo)}?drive=error`)
  }
})

async function getDriveAccessToken(req) {
  const sessionId = String(req.headers['x-drive-session'] || '')
  const session = sessionId ? driveSessions.get(sessionId) : null
  if (session && session.expiresAt <= Date.now()) driveSessions.delete(sessionId)
  const cookieValue = parseCookies(req).drive_refresh_token
  // Prefer the in-memory session, but fall back to the encrypted cookie so a
  // request routed to another Render instance survives the OAuth callback.
  const refreshToken = session && session.expiresAt > Date.now() ? session.refreshToken : (decryptDriveRefreshToken(sessionId) || decryptDriveRefreshToken(cookieValue) || cookieValue)
  if (!refreshToken) { const error = new Error('DRIVE_AUTH_REQUIRED'); error.code = 'DRIVE_AUTH_REQUIRED'; throw error }
  // Never share an access token between DJs. A viewer session must use the
  // Google account that owns the corresponding Drive permission.
  const cacheKey = sessionId || crypto.createHash('sha256').update(refreshToken).digest('hex')
  const cached = driveTokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 30_000) return { accessToken: cached.value, cacheKey }
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' }) })
  const data = await response.json()
  if (!response.ok) { const error = new Error('DRIVE_AUTH_REQUIRED'); error.code = 'DRIVE_AUTH_REQUIRED'; throw error }
  driveTokenCache.set(cacheKey, { value: data.access_token, expiresAt: Date.now() + (data.expires_in * 1000) })
  return { accessToken: data.access_token, cacheKey }
}

async function driveList(accessToken, query, fields) {
  const params = new URLSearchParams({ q: query, fields: `nextPageToken,files(${fields})`, pageSize: '1000', orderBy: 'name' })
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw new Error('No se pudo consultar Google Drive')
  return response.json()
}

async function getDriveCatalog(accessToken, cacheKey) {
  const cached = driveCatalogCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.files
  const folders = [driveFolderId]
  const files = []
  while (folders.length) {
    const parent = folders.shift()
    let pageToken = ''
    do {
      const params = new URLSearchParams({ q: `'${parent}' in parents and trashed = false`, fields: `nextPageToken,files(id,name,mimeType,size,parents,modifiedTime)`, pageSize: '1000', orderBy: 'name' })
      if (pageToken) params.set('pageToken', pageToken)
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!response.ok) throw new Error('No se pudo leer la carpeta de Google Drive')
      const data = await response.json()
      for (const file of data.files || []) {
        if (file.mimeType === 'application/vnd.google-apps.folder') folders.push(file.id)
        else if (file.mimeType?.startsWith('audio/') || /\.(mp3|m4a|wav|aif|aiff|flac|ogg)$/i.test(file.name)) files.push(file)
      }
      pageToken = data.nextPageToken || ''
    } while (pageToken)
  }
  driveCatalogCache.set(cacheKey, { files, expiresAt: Date.now() + 5 * 60 * 1000 })
  return files
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

async function findDriveFile(accessToken, query, cacheKey) {
  const files = await getDriveCatalog(accessToken, cacheKey)
  const wanted = normalizeText(query)
  const words = wanted.split(' ').filter((word) => word.length > 1)
  return files.map((file) => {
    const name = normalizeText(file.name.replace(/\.[^.]+$/, ''))
    const matches = words.filter((word) => name.includes(word)).length
    const exact = name.includes(wanted) ? 100 : 0
    return { file, score: exact + matches * 10 }
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.file.name.localeCompare(b.file.name))[0]?.file || null
}

app.get('/api/drive/status', (req, res) => {
  const sessionId = String(req.headers['x-drive-session'] || '')
  const session = sessionId ? driveSessions.get(sessionId) : null
  const cookieToken = parseCookies(req).drive_refresh_token
  res.json({ authenticated: Boolean((session && session.expiresAt > Date.now()) || decryptDriveRefreshToken(cookieToken) || cookieToken) })
})

app.get('/api/drive/download-test', async (req, res) => {
  const fileId = String(req.query.id || '')
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return res.status(400).json({ error: 'Archivo inválido' })
  try {
    const { accessToken } = await getDriveAccessToken(req)
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!response.ok || !response.body) throw new Error('No se pudo descargar el archivo de Google Drive')
    const data = await response.arrayBuffer()
    return res.json({ ok: true, fileId, bytes: data.byteLength, contentType: response.headers.get('content-type') || 'application/octet-stream' })
  } catch (error) {
    if (error.code === 'DRIVE_AUTH_REQUIRED') return res.status(401).json({ error: 'DRIVE_AUTH_REQUIRED' })
    console.error(error.message)
    return res.status(503).json({ error: 'No se pudo probar la descarga de Google Drive' })
  }
})

app.get('/api/drive/preview', async (req, res) => {
  const fileId = String(req.query.id || '')
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return res.status(400).json({ error: 'Archivo inválido' })
  try {
    const { accessToken, cacheKey } = await getDriveAccessToken(req)
    const files = await getDriveCatalog(accessToken, cacheKey)
    const file = files.find((item) => item.id === fileId)
    if (!file) return res.status(404).json({ error: 'Archivo no encontrado' })
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!response.ok || !response.body) return res.status(503).json({ error: 'No se pudo leer el archivo de Google Drive' })
    res.status(200).set({ 'Content-Type': response.headers.get('content-type') || 'audio/mpeg', 'Content-Length': response.headers.get('content-length') || undefined, 'Content-Disposition': `inline; filename="${file.name.replace(/["\\r\\n]/g, '')}"`, 'Cache-Control': 'no-store' })
    return Readable.fromWeb(response.body).pipe(res)
  } catch (error) {
    if (error.code === 'DRIVE_AUTH_REQUIRED') return res.status(401).json({ error: 'DRIVE_AUTH_REQUIRED' })
    console.error(error.message)
    return res.status(503).json({ error: 'No se pudo leer el archivo de Google Drive' })
  }
})

app.get('/api/drive/search', async (req, res) => {
  const query = String(req.query.q || '').trim()
  if (query.length < 2 || query.length > 160) return res.status(400).json({ error: 'Búsqueda inválida' })
  try {
    const { accessToken, cacheKey } = await getDriveAccessToken(req)
    const files = await getDriveCatalog(accessToken, cacheKey)
    const wanted = normalizeText(query)
    const words = wanted.split(' ').filter((word) => word.length > 1)
    const matches = files.map((file) => {
      const name = normalizeText(file.name.replace(/\.[^.]+$/, ''))
      const score = (name.includes(wanted) ? 100 : 0) + words.filter((word) => name.includes(word)).length * 10
      return { file, score }
    }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.file.name.localeCompare(b.file.name)).slice(0, 20)
    return res.json({ query, matches: matches.map(({ file, score }) => ({ id: file.id, name: file.name, mimeType: file.mimeType, size: file.size, score })) })
  } catch (error) {
    if (error.code === 'DRIVE_AUTH_REQUIRED') return res.status(401).json({ error: 'DRIVE_AUTH_REQUIRED' })
    console.error(error.message)
    return res.status(503).json({ error: 'No se pudo consultar Google Drive' })
  }
})

async function streamDriveFile(req, res, query, format) {
  const { accessToken, cacheKey } = await getDriveAccessToken(req)
  const file = await findDriveFile(accessToken, query, cacheKey)
  if (!file) return false
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok || !response.body) throw new Error('No se pudo descargar el archivo de Google Drive')
  const extension = path.extname(file.name).slice(1).toLowerCase() || format
  res.status(200).set({ 'Content-Type': response.headers.get('content-type') || 'application/octet-stream', 'Content-Length': response.headers.get('content-length') || undefined, 'Content-Disposition': `attachment; filename="${file.name.replace(/["\r\n]/g, '')}"`, 'Cache-Control': 'no-store' })
  Readable.fromWeb(response.body).pipe(res)
  return true
}

async function getSpotifyToken() {
  if (spotifyTokenCache.value && spotifyTokenCache.expiresAt > Date.now() + 30_000) return spotifyTokenCache.value
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Spotify no está configurado en el servidor')
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' })
  if (!response.ok) throw new Error('No se pudo autenticar con Spotify')
  const data = await response.json()
  spotifyTokenCache = { value: data.access_token, expiresAt: Date.now() + (data.expires_in * 1000) }
  return spotifyTokenCache.value
}

app.get('/api/spotify-search', async (req, res) => {
  const query = String(req.query.q || '').trim()
  if (!query) return res.status(400).json({ error: 'Falta la búsqueda' })
  try {
    const token = await getSpotifyToken()
    const params = new URLSearchParams({ q: query, type: 'track', limit: '8', market: 'PE' })
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) return res.status(response.status).json({ error: 'Spotify no respondió' })
    const data = await response.json()
    return res.json({ tracks: (data.tracks?.items || []).map((track) => ({ id: track.id, title: track.name, artist: track.artists.map((artist) => artist.name).join(', '), duration: `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}`, thumbnail: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || '' })) })
  } catch (error) { return res.status(503).json({ error: error.message }) }
})

app.post('/api/youtube-download', async (req, res) => {
  const videoId = String(req.body?.videoId || '')
  const query = String(req.body?.query || '').trim().replace(/[\r\n]+/g, ' ')
  const format = req.body?.format === 'm4a' ? 'm4a' : 'mp3'
  const validVideoId = /^[A-Za-z0-9_-]{11}$/.test(videoId)
  if (!validVideoId && (query.length < 2 || query.length > 160)) return res.status(400).json({ error: 'Canción inválida' })

  // Search the user's private Drive catalog first for every requested song.
  if (query) {
    try {
      if (await streamDriveFile(req, res, query, format)) return
    } catch (error) {
      if (error.code === 'DRIVE_AUTH_REQUIRED') return res.status(401).json({ error: 'DRIVE_AUTH_REQUIRED' })
      console.error(error.message)
    }
  }

  const executable = process.env.YTDLP_PATH || path.join(process.cwd(), 'bin', 'yt-dlp')
  const source = validVideoId ? `https://www.youtube.com/watch?v=${videoId}` : `ytsearch1:${query}`
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rc-youtube-'))
  const outputBase = path.join(directory, 'audio')
  const args = ['--no-playlist', '--no-warnings', '-x', '--audio-format', format, '--audio-quality', '0', '-o', `${outputBase}.%(ext)s`, source]
  const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  let errorText = ''
  child.stderr.on('data', (chunk) => { errorText += String(chunk).slice(-2000) })
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve) })
    if (code !== 0) throw new Error(errorText || 'No se pudo preparar el audio')
    const files = await readdir(directory)
    const file = files.find((name) => name.endsWith(`.${format}`))
    if (!file) throw new Error('El archivo de audio no fue generado')
    const filePath = path.join(directory, file)
    const info = await stat(filePath)
    res.status(200).set({ 'Content-Type': format === 'm4a' ? 'audio/mp4' : 'audio/mpeg', 'Content-Length': String(info.size), 'Content-Disposition': `attachment; filename="youtube-${videoId || 'search'}.${format}"`, 'Cache-Control': 'no-store' })
    createReadStream(filePath).pipe(res)
    res.once('finish', () => rm(directory, { recursive: true, force: true }).catch(() => {}))
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
    if (!res.headersSent) res.status(502).json({ error: 'No se pudo preparar el audio' })
    console.error(error.message)
  }
  req.once('close', () => { if (!res.writableEnded) child.kill('SIGTERM') })
})

app.listen(port, () => console.log(`RC music_eventos API escuchando en el puerto ${port}`))
