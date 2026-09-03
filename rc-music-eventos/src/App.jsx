import { Component, useEffect, useState } from 'react'
import HomeScreen from './components/HomeScreen'
import JoinEvent from './components/JoinEvent'
import AttendeeApp from './components/AttendeeApp'
import DjLogin from './components/DjLogin'
import DjApp from './components/DjApp'
import { getEvents, saveEvents } from './lib/storage'
import { supabaseEnabled, ensureAnonymousSession, setRequestStatus, getStoredDjSession, signOutDj } from './lib/supabase'


class ScreenErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error) { console.error('RC music screen error', error) }
  render() {
    if (this.state.hasError) return <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-white"><div><p className="font-display text-2xl font-bold">No se pudo cargar esta pantalla</p><p className="mt-2 text-sm text-white/50">Recarga la página para volver a intentarlo.</p>{this.state.error?.message && <p className="mt-3 text-xs text-red-300">{this.state.error.message}</p>}<button onClick={() => window.location.reload()} className="btn-primary mt-5">Recargar</button></div></div>
    return this.props.children
  }
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [activeEvent, setActiveEvent] = useState(null)
  const [djSession, setDjSession] = useState(() => getStoredDjSession())
  useEffect(() => { getEvents(); if (supabaseEnabled) ensureAnonymousSession().catch(() => {}) }, [])
  async function updateEvent(nextEvent) {
    const previous = activeEvent
    if (supabaseEnabled && previous && !previous.localOnly) {
      const previousById = Object.fromEntries((previous.requests || []).map((request) => [request.id, request]))
      for (const request of nextEvent.requests || []) { const oldRequest = previousById[request.id]; if (oldRequest && oldRequest.status !== request.status) await setRequestStatus(request.id, request.status, djSession?.token) }
    } else { const events = getEvents().map((event) => event.id === nextEvent.id ? nextEvent : event); saveEvents(events) }
    setActiveEvent(nextEvent)
  }
  function leaveDj() { signOutDj(djSession?.token); setDjSession(null); setScreen('home') }
  if (screen === 'attendee-join') return <JoinEvent onBack={() => setScreen('home')} onJoin={(event) => { setActiveEvent(event); setScreen('attendee') }} />
  if (screen === 'attendee' && activeEvent) return <ScreenErrorBoundary><AttendeeApp event={activeEvent} onUpdate={updateEvent} onExit={() => { setActiveEvent(null); setScreen('home') }} /></ScreenErrorBoundary>
  if (screen === 'dj-login') return <DjLogin onBack={() => setScreen('home')} onLogin={(session) => { setDjSession(session); setScreen('dj') }} />
  if (screen === 'dj' && djSession) return <ScreenErrorBoundary><DjApp session={djSession} onExit={leaveDj} /></ScreenErrorBoundary>
  return <HomeScreen onAttendee={() => setScreen('attendee-join')} onDj={() => setScreen('dj-login')} />
}
