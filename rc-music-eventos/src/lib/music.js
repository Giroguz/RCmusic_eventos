const MOCK_TRACKS = [
  { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', duration: '3:33', source: 'youtube' },
  { id: '9bZkp7q19f0', title: 'Gangnam Style', artist: 'PSY', duration: '4:13', source: 'youtube' },
  { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', duration: '4:42', source: 'youtube' },
  { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', duration: '4:24', source: 'youtube' },
  { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', duration: '5:55', source: 'youtube' },
  { id: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', duration: '4:30', source: 'youtube' },
]

export const MUSIC_PROVIDERS = [{ id: 'youtube', label: 'YouTube' }]

function formatDuration(seconds) {
  const total = Number(seconds)
  if (!Number.isFinite(total) || total <= 0) return '—'
  const minutes = Math.floor(total / 60)
  const remainder = Math.floor(total % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

export function withMedia(track) {
  if (track.source === 'spotify') {
    return { ...track, thumbnail: track.thumbnail || '', spotifyUrl: track.url || `https://open.spotify.com/track/${track.id}`, embedUrl: `https://open.spotify.com/embed/track/${track.id}` }
  }
  if (track.source === 'deezer' || track.source === 'soundcloud') {
    return { ...track, thumbnail: track.thumbnail || '', externalUrl: track.url || '', previewUrl: track.previewUrl || '' }
  }
  return { ...track, source: 'youtube', thumbnail: track.thumbnail || `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`, videoUrl: track.videoUrl || `https://www.youtube-nocookie.com/embed/${track.id}?autoplay=1&rel=0` }
}

async function searchYoutube(query) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
  if (!apiKey) {
    const normalized = query.toLowerCase()
    const matched = MOCK_TRACKS.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(normalized))
    const fallback = matched.length ? matched : MOCK_TRACKS.slice(0, 4).map((track, index) => ({ ...track, title: `${query} — selección ${index + 1}` }))
    return fallback.map(withMedia)
  }
  const params = new URLSearchParams({ part: 'snippet', maxResults: '8', q: query, type: 'video', videoCategoryId: '10', key: apiKey })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  if (!response.ok) throw new Error('No se pudo consultar YouTube')
  const data = await response.json()
  return (data.items || []).filter((item) => item.id?.videoId).map((item) => withMedia({ id: item.id.videoId, title: item.snippet.title, artist: item.snippet.channelTitle, duration: 'YouTube', source: 'youtube' }))
}

async function searchDeezer(query) {
  const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=8`)
  if (!response.ok) return []
  const data = await response.json()
  return (data.data || []).map((track) => withMedia({ id: String(track.id), title: track.title, artist: track.artist?.name || 'Deezer', duration: formatDuration(track.duration), thumbnail: track.album?.cover_medium || track.album?.cover, previewUrl: track.preview, url: track.link, source: 'deezer' }))
}

async function searchSoundCloud(query) {
  const clientId = import.meta.env.VITE_SOUNDCLOUD_CLIENT_ID
  if (!clientId) return []
  const params = new URLSearchParams({ q: query, limit: '8', client_id: clientId })
  const response = await fetch(`https://api-v2.soundcloud.com/search/tracks?${params}`)
  if (!response.ok) return []
  const data = await response.json()
  return (data.collection || []).map((track) => withMedia({ id: String(track.id), title: track.title, artist: track.user?.username || 'SoundCloud', duration: formatDuration(Number(track.duration || 0) / 1000), thumbnail: track.artwork_url || track.user?.avatar_url, previewUrl: track.stream_url || '', url: track.permalink_url, source: 'soundcloud' }))
}

async function searchSpotify(query) {
  const apiBase = import.meta.env.VITE_SPOTIFY_API_BASE_URL
  if (!apiBase) return []
  const response = await fetch(`${apiBase.replace(/\/$/, '')}/spotify-search?q=${encodeURIComponent(query)}`)
  if (!response.ok) return []
  const data = await response.json()
  return (data.tracks || []).map((track) => withMedia({ id: track.id, title: track.title, artist: track.artist, duration: track.duration, thumbnail: track.thumbnail, url: track.url, source: 'spotify' }))
}

function externalSearch(provider, query) {
  const urls = {
    spotify: `https://open.spotify.com/search/${encodeURIComponent(query)}`,
    soundcloud: `https://soundcloud.com/search/sounds?q=${encodeURIComponent(query)}`,
    deezer: `https://www.deezer.com/search/${encodeURIComponent(query)}`,
  }
  const labels = { spotify: 'Spotify', soundcloud: 'SoundCloud', deezer: 'Deezer' }
  return { id: `external-${provider}-${encodeURIComponent(query)}`, title: `Buscar “${query}” en ${labels[provider]}`, artist: 'Abrir resultados del proveedor', duration: '', source: provider, external: true, externalUrl: urls[provider], thumbnail: '' }
}

export async function searchTracks(query) {
  const normalized = query.trim()
  if (!normalized) return []
  return searchYoutube(normalized)
}
