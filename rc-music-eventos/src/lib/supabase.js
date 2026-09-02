import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = Boolean(url && anonKey)
export const supabase = supabaseEnabled ? createClient(url, anonKey) : null

export async function ensureAnonymousSession() {
  if (!supabase) return null
  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) return existing.session
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}

export async function signInDj(email, password) {
  if (!supabase) return null
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function signOutDj() {
  if (supabase) await supabase.auth.signOut()
}

function mapRequest(row) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    videoId: row.video_id,
    source: String(row.video_id || '').startsWith('spotify:') ? 'spotify' : 'youtube',
    spotifyId: String(row.video_id || '').replace(/^spotify:/, ''),
    thumbnail: row.thumbnail,
    requester: row.requester,
    dedication: row.dedication || '',
    likes: row.likes || 0,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function mapEvent(row, requests = []) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    djName: row.dj_name,
    contact: row.contact || '',
    yapeNumber: row.yape_number || '',
    thankYou: row.thank_you || '',
    createdAt: row.created_at,
    requests: requests.map(mapRequest),
  }
}

export async function getPublicEvent(query) {
  if (!supabase) return null
  await ensureAnonymousSession()
  const normalized = query.trim().toLowerCase()
  const { data: event, error } = await supabase.from('events').select('*').or(`code.ilike.${normalized},name.ilike.${normalized}`).maybeSingle()
  if (error) throw error
  if (!event) return null
  const { data: requests, error: requestsError } = await supabase.from('song_requests').select('*').eq('event_id', event.id).order('likes', { ascending: false })
  if (requestsError) throw requestsError
  return mapEvent(event, requests || [])
}

export async function getDjEvents() {
  if (!supabase) return []
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return []
  const { data: events, error } = await supabase.from('events').select('*').eq('owner_id', userData.user.id).order('created_at', { ascending: false })
  if (error) throw error
  if (!events?.length) return []
  const ids = events.map((event) => event.id)
  const { data: requests, error: requestsError } = await supabase.from('song_requests').select('*').in('event_id', ids).order('likes', { ascending: false })
  if (requestsError) throw requestsError
  return events.map((event) => mapEvent(event, (requests || []).filter((request) => request.event_id === event.id)))
}

export async function createDjEvent(input) {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Debes iniciar sesión como DJ')
  const { data, error } = await supabase.from('events').insert({
    owner_id: userData.user.id,
    code: input.code,
    name: input.name,
    dj_name: input.djName,
    contact: input.contact,
    yape_number: input.yapeNumber,
    thank_you: input.thankYou,
  }).select().single()
  if (error) throw error
  return mapEvent(data, [])
}

export async function addSongRequest(eventId, song, form) {
  const { data, error } = await supabase.from('song_requests').insert({
    event_id: eventId,
    video_id: song.source === 'spotify' ? `spotify:${song.id}` : song.id,
    title: song.title,
    artist: song.artist,
    thumbnail: song.thumbnail,
    requester: form.requester,
    dedication: form.dedication || null,
  }).select().single()
  if (error) throw error
  return mapRequest(data)
}

export async function likeSongRequest(requestId) {
  const { error } = await supabase.rpc('like_request', { request_uuid: requestId })
  if (error) throw error
}

export async function setRequestStatus(requestId, status) {
  const { error } = await supabase.from('song_requests').update({ status }).eq('id', requestId)
  if (error) throw error
}

export function subscribeToEvent(eventId, callback) {
  if (!supabase) return () => {}
  const channel = supabase.channel(`event-${eventId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${eventId}` }, callback).subscribe()
  return () => { supabase.removeChannel(channel) }
}
