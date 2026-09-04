import { useEffect, useState } from 'react'
import HomeScreen from './components/HomeScreen'
import JoinEvent from './components/JoinEvent'
import AttendeeApp from './components/AttendeeApp'
import DjLogin from './components/DjLogin'
import DjApp from './components/DjApp'
import { getEvents, saveEvents } from './lib/storage'
import { supabaseEnabled, ensureAnonymousSession, setRequestStatus } from './lib/supabase'

export default function App() {
 const [screen, setScreen] = useState(() => {
 try { return localStorage.getItem('rc_drive_return_screen') === 'dj' && localStorage.getItem('rc_drive_session') ? 'dj' : 'home' } catch { return 'home' }
 })
 const [activeEvent, setActiveEvent] = useState(null)

 useEffect(() => {
 // Inicializa la demo o una sesión anónima de Supabase.
 getEvents()
 if (supabaseEnabled) ensureAnonymousSession().catch(() => {})
 }, [])

 useEffect(() => {
 if (screen === 'dj') {
 try { localStorage.removeItem('rc_drive_return_screen') } catch {}
 }
 }, [screen])

 async function updateEvent(nextEvent) {
 const previous = activeEvent
 if (supabaseEnabled && previous && !previous.localOnly) {
 const previousById = Object.fromEntries((previous.requests || []).map((request) => [request.id, request]))
 for (const request of nextEvent.requests || []) {
 const oldRequest = previousById[request.id]
 if (oldRequest && oldRequest.status !== request.status) await setRequestStatus(request.id, request.status)
 }
 } else {
 const events = getEvents().map((event) => event.id === nextEvent.id ? nextEvent : event)
 saveEvents(events)
 }
 setActiveEvent(nextEvent)
 }

 if (screen === 'attendee-join') return <JoinEvent onBack={() => setScreen('home')} onJoin={(event) => { setActiveEvent(event); setScreen('attendee') }} />
 if (screen === 'attendee' && activeEvent) return <AttendeeApp event={activeEvent} onUpdate={updateEvent} onExit={() => { setActiveEvent(null); setScreen('home') }} />
 if (screen === 'dj-login') return <DjLogin onBack={() => setScreen('home')} onLogin={() => setScreen('dj')} />
 if (screen === 'dj') return <DjApp onExit={() => setScreen('home')} />
 return <HomeScreen onAttendee={() => setScreen('attendee-join')} onDj={() => setScreen('dj-login')} />
}
