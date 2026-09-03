import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = Boolean(url && anonKey && !String(url).includes('tu-proyecto'))
export const supabase = supabaseEnabled ? createClient(url, anonKey) : null
const SESSION_KEY = 'rc_music_dj_session_v1'

export function getStoredDjSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}
function storeDjSession(value) { try { if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY) } catch {} }

export async function ensureAnonymousSession() {
  if (!supabase) return null
  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) return existing.session
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}

// DJ access is deliberately not backed by a shared frontend password. The RPC validates
// a per-DJ code server-side and returns a short-lived, revocable session token.
export async function startDjTrial(email, displayName) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('dj_start_trial', { p_email: email.trim().toLowerCase(), p_display_name: displayName.trim() })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.generated_code) throw new Error('Trial unavailable')
  return row
}

export async function signInDj(email, code) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('dj_login', { p_email: email.trim().toLowerCase(), p_code: code })
  if (error) throw error
  const access = Array.isArray(data) ? data[0] : data
  if (!access?.session_token) throw new Error('Access denied')
  const session = { token: access.session_token, ...access }
  delete session.session_token
  session.token = access.session_token
  storeDjSession(session)
  return session
}

export async function getDjAccess(token = getStoredDjSession()?.token) {
  if (!supabase || !token) return null
  const { data, error } = await supabase.rpc('dj_check_access', { p_token: token })
  if (error) throw error
  const access = Array.isArray(data) ? data[0] : data
  if (!access?.is_active) { storeDjSession(null); return null }
  return { token, ...access }
}

export async function signOutDj(token = getStoredDjSession()?.token) {
  if (supabase && token) await supabase.rpc('dj_logout', { p_token: token }).catch(() => {})
  storeDjSession(null)
}

function mapRequest(row) {
  const videoId = String(row.video_id || ''); const source = videoId.match(/^(spotify|deezer|soundcloud):/)?.[1] || 'youtube'; return { id: row.id, title: row.title, artist: row.artist, videoId, source, spotifyId: videoId.replace(/^spotify:/, ''), thumbnail: row.thumbnail, requester: row.requester, dedication: row.dedication || '', likes: row.likes || 0, status: row.status, createdAt: row.created_at }
}
export function mapEvent(row, requests = []) {
  return { id: row.id, code: row.code, name: row.name, djName: row.dj_name, contact: row.contact || '', yapeNumber: row.yape_number || '', thankYou: row.thank_you || '', createdAt: row.created_at, requests: requests.map(mapRequest) }
}

export async function getPublicEvent(query) {
  if (!supabase) return null
  await ensureAnonymousSession()
  const normalized = query.trim().toUpperCase()
  const { data: event, error } = await supabase.from('events').select('*').eq('code', normalized).maybeSingle()
  if (error) throw error
  if (!event) return null
  const { data: requests, error: requestsError } = await supabase.from('song_requests').select('*').eq('event_id', event.id).order('likes', { ascending: false })
  if (requestsError) throw requestsError
  return mapEvent(event, requests || [])
}

export async function getDjEvents(token = getStoredDjSession()?.token) {
  if (!supabase || !token) return []
  const { data, error } = await supabase.rpc('dj_get_events', { p_token: token })
  if (error) throw error
  return (data || []).map((row) => mapEvent(row, row.requests || []))
}

export async function createDjEvent(input, token = getStoredDjSession()?.token) {
  if (!supabase || !token) throw new Error('DJ session required')
  const { data, error } = await supabase.rpc('dj_create_event', { p_token: token, p_code: input.code, p_name: input.name, p_dj_name: input.djName, p_contact: input.contact, p_yape_number: input.yapeNumber, p_thank_you: input.thankYou })
  if (error) throw error
  return mapEvent(Array.isArray(data) ? data[0] : data, [])
}

export async function updateDjEventInfo(eventId, input, token = getStoredDjSession()?.token) {
  if (!supabase || !token) throw new Error('DJ session required')
  const { data, error } = await supabase.rpc('dj_update_event_info', { p_token: token, p_event_id: eventId, p_dj_name: input.djName, p_yape_number: input.yapeNumber, p_contact: input.contact })
  if (error) throw error
  return mapEvent(Array.isArray(data) ? data[0] : data, [])
}

export async function addSongRequest(eventId, song, form) {
  const { data, error } = await supabase.from('song_requests').insert({ event_id: eventId, video_id: song.source === 'youtube' ? song.id : `${song.source}:${song.id}`, title: song.title, artist: song.artist, thumbnail: song.thumbnail, requester: form.requester, dedication: form.dedication || null }).select().single()
  if (error) throw error
  return mapRequest(data)
}
export async function likeSongRequest(requestId) { const { error } = await supabase.rpc('like_request', { request_uuid: requestId }); if (error) throw error }
export async function setRequestStatus(requestId, status, token = getStoredDjSession()?.token) { const { error } = await supabase.rpc('dj_set_request_status', { p_token: token, p_request_id: requestId, p_status: status }); if (error) throw error }

function account(row) { return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, approved: row.approved, blocked: row.blocked, planType: row.plan_type, planStartedAt: row.plan_started_at, planExpiresAt: row.plan_expires_at, daysUsed: row.days_used, daysRemaining: row.days_remaining, isActive: row.is_active, generatedCode: row.generated_code } }
export async function adminListDjs(token) { const { data, error } = await supabase.rpc('admin_list_djs', { p_token: token }); if (error) throw error; return (data || []).map(account) }
export async function adminCreateDj(input, token) { const { data, error } = await supabase.rpc('admin_create_dj', { p_token: token, p_email: input.email, p_display_name: input.displayName, p_plan_type: input.planType || 'monthly' }); if (error) throw error; return account(Array.isArray(data) ? data[0] : data) }
export async function adminSetDjState(id, state, token) { const { data, error } = await supabase.rpc('admin_set_dj_state', { p_token: token, p_dj_id: id, p_approved: state.approved, p_blocked: state.blocked }); if (error) throw error; return account(Array.isArray(data) ? data[0] : data) }
export async function adminSetDjPlan(id, planType, token) { const { data, error } = await supabase.rpc('admin_set_dj_plan', { p_token: token, p_dj_id: id, p_plan_type: planType }); if (error) throw error; return account(Array.isArray(data) ? data[0] : data) }
export async function adminRegenerateCode(id, token) { const { data, error } = await supabase.rpc('admin_regenerate_code', { p_token: token, p_dj_id: id }); if (error) throw error; return account(Array.isArray(data) ? data[0] : data) }

export function subscribeToEvent(eventId, callback) {
  if (!supabase) return () => {}
  const channel = supabase.channel(`event-${eventId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${eventId}` }, callback).subscribe()
  return () => { supabase.removeChannel(channel) }
}
