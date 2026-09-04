const apiBase = String(import.meta.env.VITE_SPOTIFY_API_BASE_URL || '').replace(/\/$/, '')

function getDriveSession() {
 try { return localStorage.getItem('rc_drive_session') || sessionStorage.getItem('rc_drive_session') || '' } catch { return '' }
}

function captureDriveSession() {
 try {
 const url = new URL(window.location.href)
 const session = url.searchParams.get('drive_session')
 if (session) {
 localStorage.setItem('rc_drive_session', session)
 sessionStorage.setItem('rc_drive_session', session)
 localStorage.setItem('rc_drive_return_screen', 'dj')
 sessionStorage.setItem('rc_drive_return_screen', 'dj')
 url.searchParams.delete('drive_session')
 url.searchParams.delete('drive')
 window.history.replaceState({}, document.title, url.toString())
 }
 } catch {}
}

captureDriveSession()

function driveRequestHeaders() {
 const driveSession = getDriveSession()
 return { 'Content-Type': 'application/json', ...(driveSession ? { 'X-Drive-Session': driveSession } : {}) }
}

async function handleDriveResponse(response) {
 if (response.ok) return response
 const error = (await response.json().catch(() => null))?.error
 if (response.status === 401 && error === 'DRIVE_AUTH_REQUIRED') {
 try { localStorage.removeItem('rc_drive_session'); sessionStorage.removeItem('rc_drive_session'); localStorage.setItem('rc_drive_return_screen', 'dj'); sessionStorage.setItem('rc_drive_return_screen', 'dj') } catch {}
 window.location.href = `${apiBase}/drive/auth?returnTo=${encodeURIComponent(window.location.href)}`
 }
 throw new Error(error || 'DOWNLOAD_FAILED')
}

export async function searchDriveAudio(query) {
 captureDriveSession()
 const response = await fetch(`${apiBase}/drive/search?q=${encodeURIComponent(String(query || '').trim())}`, { headers: driveRequestHeaders(), credentials: 'include' })
 const data = await handleDriveResponse(response).then((value) => value.json())
 return data.matches || []
}

export async function fetchDriveAudio(fileId) {
 captureDriveSession()
 const response = await fetch(`${apiBase}/drive/preview?id=${encodeURIComponent(fileId)}`, { headers: driveRequestHeaders(), credentials: 'include' })
 return handleDriveResponse(response).then((value) => value.blob())
}

export async function downloadDriveAudio(fileId, fileName = 'cancion') {
 const blob = await fetchDriveAudio(fileId)
 const url = URL.createObjectURL(blob)
 const link = document.createElement('a')
 link.href = url
 link.download = String(fileName || 'cancion').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'cancion'
 document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
}

export async function downloadYoutubeAudio(videoId, _format = 'mp3', fileName = 'cancion', searchQuery = '') {
 captureDriveSession()
 if (!apiBase) throw new Error('DOWNLOAD_API_NOT_CONFIGURED')
 const cleanId = String(videoId || '').replace(/^youtube:/, '')
 const body = /^[A-Za-z0-9_-]{11}$/.test(cleanId)
 ? { videoId: cleanId }
 : { query: String(searchQuery || '').trim() }
 if (!body.videoId && !body.query) throw new Error('INVALID_DOWNLOAD_SOURCE')
 const response = await fetch(`${apiBase}/youtube-download`, { method: 'POST', headers: driveRequestHeaders(), credentials: 'include', body: JSON.stringify(body) })
 const blob = await handleDriveResponse(response).then((value) => value.blob())
 const url = URL.createObjectURL(blob)
 const link = document.createElement('a')
 link.href = url
 link.download = `${String(fileName).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'cancion'}.mp3`
 document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
}
