const EVENTS_KEY = 'rc_music_eventos_events_v1'
const LIKES_KEY = 'rc_music_eventos_likes_v1'

const seedEvent = {
  id: 'demo-fiesta-90s',
  code: 'EVENTO',
  name: 'Ritmo de los 90s',
  djName: 'DJ Gianfranco',
  contact: '+51 999 888 777',
  yapeNumber: '999 888 777',
  thankYou: 'Si la estás pasando bien, deja tu flow por Yape. ¡Gracias por hacer vibrar la pista!',
  createdAt: new Date().toISOString(),
  requests: [],

}

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export function getEvents() {
  const events = read(EVENTS_KEY, null)
  if (events?.length) {
    // El evento local de demostración no debe conservar pedidos de prueba.
    const cleaned = events.map((event) => event.id === seedEvent.id ? { ...event, requests: [] } : event)
    if (JSON.stringify(cleaned) !== JSON.stringify(events)) localStorage.setItem(EVENTS_KEY, JSON.stringify(cleaned))
    return cleaned
  }
  localStorage.setItem(EVENTS_KEY, JSON.stringify([seedEvent]))
  return [seedEvent]
}

export function saveEvents(events) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
  window.dispatchEvent(new CustomEvent('rc-events-updated', { detail: events }))
}

export function findEvent(query) {
  const normalized = query.trim().toLowerCase()
  return getEvents().find((event) =>
    event.code.toLowerCase() === normalized || event.name.toLowerCase() === normalized,
  )
}

export function makeCode(existingCodes = []) {
  let code
  do {
    code = `RC${Math.floor(1000 + Math.random() * 9000)}`
  } while (existingCodes.includes(code))
  return code
}

export function getLikedIds(eventId) {
  return read(LIKES_KEY, {})[eventId] || []
}

export function saveLikedIds(eventId, ids) {
  const all = read(LIKES_KEY, {})
  all[eventId] = ids
  localStorage.setItem(LIKES_KEY, JSON.stringify(all))
}
