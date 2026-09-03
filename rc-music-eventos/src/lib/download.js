const apiBase = String(import.meta.env.VITE_SPOTIFY_API_BASE_URL || '').replace(/\/$/, '')

export async function downloadYoutubeAudio(videoId, format = 'mp3', fileName = 'cancion') {
  if (!apiBase) throw new Error('DOWNLOAD_API_NOT_CONFIGURED')
  const cleanId = String(videoId || '').replace(/^youtube:/, '')
  if (!/^[A-Za-z0-9_-]{11}$/.test(cleanId)) throw new Error('INVALID_YOUTUBE_ID')
  const response = await fetch(`${apiBase}/youtube-download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: cleanId, format }) })
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'DOWNLOAD_FAILED')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${String(fileName).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'cancion'}.${format}`
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
}
