import 'dotenv/config'
import express from 'express'
import cors from 'cors'

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

app.listen(port, () => {
  console.log(`RC music_eventos API escuchando en el puerto ${port}`)
})
