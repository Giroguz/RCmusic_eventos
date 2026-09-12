const MOCK_TRACKS = [
  { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', duration: '3:33', source: 'youtube' },
  { id: '9bZkp7q19f0', title: 'Gangnam Style', artist: 'PSY', duration: '4:13', source: 'youtube' },
  { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', duration: '4:42', source: 'youtube' },
  { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', duration: '4:24', source: 'youtube' },
  { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', duration: '5:55', source: 'youtube' },
  { id: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', duration: '4:30', source: 'youtube' },
]

export const MUSIC_PROVIDERS = [
  { id: 'spotify', label: 'Spotify' },
const MOCK_TRACKS = [
  { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', duration: '3:33', source: 'youtube' },
  { id: '9bZkp7q19f0', title: 'Gangnam Style', artist: 'PSY', duration: '4:13', source: 'youtube' },
  { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', duration: '4:42', source: 'youtube' },
  { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', duration: '4:24', source: 'youtube' },
  { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', duration: '5:55', source: 'youtube' },
  { id: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', duration: '4:30', source: 'youtube' },
]

export const MUSIC_PROVIDERS = [
  { id: 'spotify', label: 'Spotify' },
  { id: 'deezer', label: 'Deezer' },
  { id: 'soundcloud', label: 'SoundCloud' },
  { id: 'youtube', label: 'YouTube' },
]

const CACHE_KEY = 'rcMusicSearchCache:v2'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const CACHE_LIMIT = 120

function formatDuration(seconds) {
  const total = Number(seconds)
  if (!Number.isFinite(total) || total <= 0) return '—'
  const minutes = Math.floor(total / 60)
  const remainder = Math.floor(total % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

function cacheRead(key) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const entry = cache[key]
    if (!entry) return null
    if (Date.now() - entry.savedAt > CACHE_TTL) {
      delete cache[key]
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
      return null
    }
    return Array.isArray(entry.results) ? entry.results : null
  } catch {
    return null
  }
}

function cacheWrite(key, results) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    cache[key] = { savedAt: Date.now(), results }
    const keys = Object.keys(cache).sort((a, b) => cache[b].savedAt - cache[a].savedAt).slice(0, CACHE_LIMIT)
    const trimmed = Object.fromEntries(keys.map((item) => [item, cache[item]]))
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed))
  } catch {
    // The search must continue even when browser storage is unavailable.
  }
}

function normalizeQuery(query) {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

function dedupeTracks(tracks) {
  const seen = new Set()
  return tracks.filter((track) => {
    const key = `${track.source}:${track.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function withMedia(track) {
  if (track.source === 'spotify') {
    return { ...track, thumbnail: track.thumbnail || '', spotifyUrl: track.spotifyUrl || track.url || `https://open.spotify.com/track/${track.id}`, embedUrl: track.embedUrl || `https://open.spotify.com/embed/track/${track.id}` }
  }
  if (track.source === 'deezer' || track.source === 'soundcloud') {
    return { ...track, thumbnail: track.thumbnail || '', externalUrl: track.externalUrl || track.url || '', previewUrl: track.previewUrl || '' }
  }
  return { ...track, source: 'youtube', thumbnail: track.thumbnail || `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`, videoUrl: track.videoUrl || `https://www.youtube-nocookie.com/embed/${track.id}?autoplay=1&rel=0` }
}

function decodeHtml(value = '') {
  if (typeof document === 'undefined') return value
  const element = document.createElement('textarea')
  element.innerHTML = value
  return element.value
}

async function searchYoutube(query) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY || 'AIzaSyD2WYJozIKKeIAYS1VknXroIJieG3didCs'
  if (!apiKey) {
    const normalized = query.toLowerCase()
    const matched = MOCK_TRACKS.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(normalized))
    const fallback = matched.length ? matched : MOCK_TRACKS.slice(0, 4).map((track, index) => ({ ...track, title: `${query} — selección ${index + 1}` }))
    return fallback.map(withMedia)
  }
  const params = new URLSearchParams({ part: 'snippet', maxResults: '8', q: query, type: 'video', videoCategoryId: '10', key: apiKey })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  if (!response.ok) {
    const normalized = query.toLowerCase()
    const matched = MOCK_TRACKS.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(normalized))
    return (matched.length ? matched : MOCK_TRACKS.slice(0, 4).map((track, index) => ({ ...track, title: `${query} — selección ${index + 1}` }))).map(withMedia)
  }
  const data = await response.json()
  return (data.items || []).filter((item) => item.id?.videoId).map((item) => withMedia({ id: item.id.videoId, title: decodeHtml(item.snippet.title), artist: decodeHtml(item.snippet.channelTitle), duration: 'YouTube', source: 'youtube' }))
}

async function searchDeezer(query) {
  try {
    const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=8`)
    if (!response.ok) return []
    const data = await response.json()
    return (data.data || []).map((track) => withMedia({ id: String(track.id), title: track.title, artist: track.artist?.name || 'Deezer', duration: formatDuration(track.duration), thumbnail: track.album?.cover_medium || track.album?.cover, previewUrl: track.preview, url: track.link, source: 'deezer' }))
  } catch {
    return []
  }
}

async function searchSoundCloud(query) {
  const clientId = import.meta.env.VITE_SOUNDCLOUD_CLIENT_ID
  if (!clientId) return []
  try {
    const params = new URLSearchParams({ q: query, limit: '8', client_id: clientId })
    const response = await fetch(`https://api-v2.soundcloud.com/search/tracks?${params}`)
    if (!response.ok) return []
    const data = await response.json()
    return (data.collection || []).map((track) => withMedia({ id: String(track.id), title: track.title, artist: track.user?.username || 'SoundCloud', duration: formatDuration(Number(track.duration || 0) / 1000), thumbnail: track.artwork_url || track.user?.avatar_url, previewUrl: track.stream_url || '', url: track.permalink_url, source: 'soundcloud' }))
  } catch {
    return []
  }
}

async function searchSpotify(query) {
  const apiBase = import.meta.env.VITE_SPOTIFY_API_BASE_URL
  if (!apiBase) return []
  try {
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/spotify-search?q=${encodeURIComponent(query)}`)
    if (!response.ok) return []
    const data = await response.json()
    return (data.tracks || []).map((track) => withMedia({ id: track.id, title: track.title, artist: track.artist, duration: track.duration, thumbnail: track.thumbnail, url: track.url, source: 'spotify' }))
  } catch {
    return []
  }
}

export async function searchTracks(query) {
  const normalized = normalizeQuery(query)
  if (!normalized) return []

  const cached = cacheRead(`all:${normalized}`)
  if (cached) return cached

  const providerResults = await Promise.all([searchSpotify(normalized), searchDeezer(normalized), searchSoundCloud(normalized)])
  const firstPass = dedupeTracks(providerResults.flat())
  if (firstPass.length) {
    cacheWrite(`all:${normalized}`, firstPass)
    return firstPass
  }

  const youtubeCached = cacheRead(`youtube:${normalized}`)
  if (youtubeCached) {
    cacheWrite(`all:${normalized}`, youtubeCached)
    return youtubeCached
  }
  const youtubeResults = await searchYoutube(normalized)
  cacheWrite(`youtube:${normalized}`, youtubeResults)
  cacheWrite(`all:${normalized}`, youtubeResults)
  return youtubeResults
}

  { id: 'youtube', label: 'YouTube' },
]

const musicApiBase = String(import.meta.env.VITE_MUSIC_API_BASE_URL || import.meta.env.VITE_SPOTIFY_API_BASE_URL || '').replace(/\/$/, '')
const pendingSearches = new Map()

function formatDuration(seconds) {
  const total = Number(seconds)
  if (!Number.isFinite(total) || total <= 0) return '—'
  const minutes = Math.floor(total / 60)
  const remainder = Math.floor(total % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

export function withMedia(track) {
  if (track.source === 'spotify') {
    return { ...track, thumbnail: track.thumbnail || '', spotifyUrl: track.spotifyUrl || track.url || `https://open.spotify.com/track/${track.id}`, embedUrl: track.embedUrl || `https://open.spotify.com/embed/track/${track.id}` }
  }
  if (track.source === 'deezer' || track.source === 'soundcloud') {
    return { ...track, thumbnail: track.thumbnail || '', externalUrl: track.externalUrl || track.url || '', previewUrl: track.previewUrl || '' }
  }
  return { ...track, source: 'youtube', thumbnail: track.thumbnail || `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`, videoUrl: track.videoUrl || `https://www.youtube-nocookie.com/embed/${track.id}?autoplay=1&rel=0` }
}

function decodeHtml(value = '') {
  if (typeof document === 'undefined') return value
  const element = document.createElement('textarea')
  element.innerHTML = value
  return element.value
}

function mockYoutubeSearch(query) {
  const normalized = query.toLowerCase()
  const matched = MOCK_TRACKS.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(normalized))
  const fallback = matched.length ? matched : MOCK_TRACKS.slice(0, 4).map((track, index) => ({ ...track, title: `${query} — selección ${index + 1}` }))
  return fallback.map(withMedia)
}

async function searchYoutube(query) {
  if (!musicApiBase) return mockYoutubeSearch(query)
  const key = `youtube:${query.toLowerCase()}`
  if (pendingSearches.has(key)) return pendingSearches.get(key)

  const pending = fetch(`${musicApiBase}/youtube-search?q=${encodeURIComponent(query)}`)
    .then(async (response) => {
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar YouTube')
      return (data.tracks || []).map(withMedia)
    })
    .finally(() => pendingSearches.delete(key))
  pendingSearches.set(key, pending)
  return pending
}

async function searchDeezer(query) {
  const endpoint = musicApiBase ? `${musicApiBase}/deezer-search?q=${encodeURIComponent(query)}` : `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=8`
  const response = await fetch(endpoint)
  if (!response.ok) return []
  const data = await response.json()
  const tracks = data.tracks || data.data || []
  return tracks.map((track) => withMedia({
    id: String(track.id),
    title: track.title,
    artist: track.artist?.name || track.artist || 'Deezer',
    duration: track.duration ? (typeof track.duration === 'number' ? formatDuration(track.duration) : track.duration) : 'Deezer',
    thumbnail: track.thumbnail || track.album?.cover_medium || track.album?.cover || '',
    previewUrl: track.previewUrl || track.preview || '',
    externalUrl: track.externalUrl || track.link || `https://www.deezer.com/track/${track.id}`,
    source: 'deezer',
  }))
}

async function searchSpotify(query) {
  if (!musicApiBase) return []
  const response = await fetch(`${musicApiBase}/spotify-search?q=${encodeURIComponent(query)}`)
  if (!response.ok) return []
  const data = await response.json()
  return (data.tracks || []).map((track) => withMedia({
    id: track.id,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    thumbnail: track.thumbnail,
    url: track.url,
    source: 'spotify',
  }))
}

export async function searchTracks(query) {
  const normalized = query.trim()
  if (!normalized) return []

  // Sequential by design: YouTube is only used when Spotify and Deezer fail.
  const spotify = await searchSpotify(normalized).catch(() => [])
  if (spotify.length) return spotify

  const deezer = await searchDeezer(normalized).catch(() => [])
  if (deezer.length) return deezer

  const youtube = await searchYoutube(normalized).catch(() => [])
  if (youtube.length) return youtube

  throw new Error('No se encontraron resultados')
}
