const EVENTS_KEY = 'rc_music_eventos_events_v1'
const LIKES_KEY = 'rc_music_eventos_likes_v1'

const seedEvent = {
  id: 'demo-fiesta-90s',
  code: 'RC26',
  name: 'Ritmo de los 90s',
  djName: 'DJ Gianfranco',
  contact: '+51 999 888 777',
  yapeNumber: '999 888 777',
  thankYou: 'Si la estás pasando bien, deja tu flow por Yape. ¡Gracias por hacer vibrar la pista!',
  createdAt: new Date().toISOString(),
  requests: [
    {
      id: 'request-1', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars',
      videoId: 'OPf0YbXqDm0', thumbnail: 'https://img.youtube.com/vi/OPf0YbXqDm0/hqdefault.jpg',
      requester: 'Camila', dedication: 'Para toda la promo', likes: 8, status: 'pending',
    },
    {
      id: 'request-2', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee',
      videoId: 'kJQP7kiw5Fk', thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
      requester: 'Marco', dedication: '', likes: 5, status: 'pending',
    },
    {
      id: 'request-3', title: 'Bohemian Rhapsody', artist: 'Queen',
      videoId: 'fJ9rUzIMcZQ', thumbnail: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
      requester: 'Sofi', dedication: 'La que sigue sí o sí', likes: 3, status: 'pending',
    },
  ],
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
  if (events?.length) return events
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
