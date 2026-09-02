const MOCK_TRACKS = [
  { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', duration: '3:33', source: 'youtube' },
  { id: '9bZkp7q19f0', title: 'Gangnam Style', artist: 'PSY', duration: '4:13', source: 'youtube' },
  { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', duration: '4:42', source: 'youtube' },
  { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', duration: '4:24', source: 'youtube' },
  { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', duration: '5:55', source: 'youtube' },
  { id: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', duration: '4:30', source: 'youtube' },
]

export function withMedia(track) {
  if (track.source === 'spotify') {
    return {
      ...track,
      thumbnail: track.thumbnail || '',
      spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      embedUrl: `https://open.spotify.com/embed/track/${track.id}`,
    }
  }
  return {
    ...track,
    source: 'youtube',
    thumbnail: `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`,
    videoUrl: `https://www.youtube-nocookie.com/embed/${track.id}?autoplay=1&rel=0`,
  }
}

async function searchYoutube(query) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
  if (!apiKey) {
    const normalized = query.toLowerCase()
    const matched = MOCK_TRACKS.filter((track) =>
      `${track.title} ${track.artist}`.toLowerCase().includes(normalized),
    )
    const fallback = matched.length ? matched : MOCK_TRACKS.slice(0, 4).map((track, index) => ({
      ...track,
      title: `${query} — selección ${index + 1}`,
    }))
    return fallback.map(withMedia)
  }

  const params = new URLSearchParams({
    part: 'snippet',
    maxResults: '8',
    q: query,
    type: 'video',
    videoCategoryId: '10',
    key: apiKey,
  })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  if (!response.ok) throw new Error('No se pudo consultar YouTube')
  const data = await response.json()
  return (data.items || [])
    .filter((item) => item.id?.videoId)
    .map((item) => withMedia({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      duration: 'YouTube',
      source: 'youtube',
    }))
}

async function searchSpotify(query) {
  const apiBase = import.meta.env.VITE_SPOTIFY_API_BASE_URL
  if (!apiBase) return []
  const response = await fetch(`${apiBase.replace(/\/$/, '')}/spotify-search?q=${encodeURIComponent(query)}`)
  if (!response.ok) return []
  const data = await response.json()
  return (data.tracks || []).map((track) => withMedia({
    id: track.id,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
    thumbnail: track.thumbnail,
    source: 'spotify',
  }))
}

export async function searchTracks(query) {
  const normalized = query.trim()
  if (!normalized) return []

  // Spotify queda como integración opcional; mientras no haya credenciales,
  // la experiencia principal funciona únicamente con resultados de YouTube.
  const youtube = await searchYoutube(normalized)
  if (!youtube.length) throw new Error('No se encontraron resultados')
  return youtube
}
