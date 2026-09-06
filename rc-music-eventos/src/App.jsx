import { useEffect, useState } from 'react'
import HomeScreen from './components/HomeScreen'
import JoinEvent from './components/JoinEvent'
import AttendeeApp from './components/AttendeeAppFixed'
import DjLogin from './components/DjLogin'
import DjApp from './components/DjApp'
import { getEvents, saveEvents } from './lib/storage'
import { supabaseEnabled, ensureAnonymousSession, setRequestStatus } from './lib/supabase'

const HISTORY_KEY = 'rcMusicScreen'

export default function App() {
  const [screen, setScreen] = useState(() => {
    try { return localStorage.getItem('rc_drive_return_screen') === 'dj' && localStorage.getItem('rc_drive_session') ? 'dj' : 'home' } catch { return 'home' }
  })
  const [activeEvent, setActiveEvent] = useState(null)

  useEffect(() => {
    getEvents()
    if (supabaseEnabled) ensureAnonymousSession().catch(() => {})
  }, [])

  useEffect(() => {
    if (screen === 'dj') {
      try { localStorage.removeItem('rc_drive_return_screen') } catch {}
    }
  }, [screen])

  useEffect(() => {
    const current = window.history.state
    if (!current?.[HISTORY_KEY]) {
      window.history.replaceState({ ...current, [HISTORY_KEY]: true, screen, activeEvent: null, appRoot: true }, '', window.location.href)
    }

    const handlePopState = (event) => {
      const state = event.state
      if (state?.[HISTORY_KEY]) {
        setScreen(state.screen || 'home')
        setActiveEvent(state.activeEvent || null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function navigate(nextScreen, nextEvent = null) {
    const current = window.history.state
    if (current?.[HISTORY_KEY] && current.screen === nextScreen && current.activeEvent?.id === nextEvent?.id) return
    const state = { ...(current || {}), [HISTORY_KEY]: true, screen: nextScreen, activeEvent: nextEvent, appRoot: false }
    window.history.pushState(state, '', window.location.href)
    setActiveEvent(nextEvent)
    setScreen(nextScreen)
  }

  function goBack() {
    if (window.history.state?.[HISTORY_KEY] && window.history.state.screen !== 'home') window.history.back()
  }

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
    if (window.history.state?.[HISTORY_KEY]) window.history.replaceState({ ...window.history.state, activeEvent: nextEvent }, '', window.location.href)
  }

  if (screen === 'attendee-join') return <JoinEvent onBack={goBack} onJoin={(event) => navigate('attendee', event)} />
  if (screen === 'attendee' && activeEvent) return <AttendeeApp event={activeEvent} onUpdate={updateEvent} onExit={goBack} />
  if (screen === 'dj-login') return <DjLogin onBack={goBack} onLogin={() => navigate('dj')} />
  if (screen === 'dj') return <DjApp onExit={goBack} />
  return <HomeScreen onAttendee={() => navigate('attendee-join')} onDj={() => navigate('dj-login')} />
}
