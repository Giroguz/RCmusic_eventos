const apiBase = String(import.meta.env.VITE_SPOTIFY_API_BASE_URL || '').replace(/\/$/, '')

function getDriveSession() {
  try { return localStorage.getItem('rc_drive_session') || '' } catch { return '' }
}

function captureDriveSession() {
  try {
    const url = new URL(window.location.href)
    const session = url.searchParams.get('drive_session')
    if (session) {
      localStorage.setItem('rc_drive_session', session)
      url.searchParams.delete('drive_session')
      url.searchParams.delete('drive')
      window.history.replaceState({}, document.title, url.toString())
    }
  } catch {}
}

captureDriveSession()

export async function downloadYoutubeAudio(videoId, format = 'mp3', fileName = 'cancion', searchQuery = '') {
  if (!apiBase) throw new Error('DOWNLOAD_API_NOT_CONFIGURED')
  const cleanId = String(videoId || '').replace(/^youtube:/, '')
  const body = /^[A-Za-z0-9_-]{11}$/.test(cleanId)
    ? { videoId: cleanId, format }
    : { query: String(searchQuery || '').trim(), format }
  if (!body.videoId && !body.query) throw new Error('INVALID_DOWNLOAD_SOURCE')
  const driveSession = getDriveSession()
  const response = await fetch(`${apiBase}/youtube-download`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(driveSession ? { 'X-Drive-Session': driveSession } : {}) }, credentials: 'include', body: JSON.stringify(body) })
  if (!response.ok) {
    const error = (await response.json().catch(() => null))?.error
    if (response.status === 401 && error === 'DRIVE_AUTH_REQUIRED') {
      try { localStorage.removeItem('rc_drive_session') } catch {}
      window.location.href = `${apiBase}/drive/auth?returnTo=${encodeURIComponent(window.location.href)}`
      return
    }
    throw new Error(error || 'DOWNLOAD_FAILED')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${String(fileName).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'cancion'}.${format}`
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
}
