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
