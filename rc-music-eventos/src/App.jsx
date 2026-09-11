import { useEffect, useRef, useState } from 'react'
import HomeScreen from './components/HomeScreen'
import JoinEvent from './components/JoinEvent'
import AttendeeApp from './components/AttendeeApp'
import DjLogin from './components/DjLogin'
import DjApp from './components/DjApp'
import AdminPanel from './components/AdminPanel'
import { getEvents, saveEvents } from './lib/storage'
import { getStoredDjSession, supabaseEnabled, ensureAnonymousSession, setRequestStatus } from './lib/supabase'

const HISTORY_KEY = 'rcMusicScreen'
const ROUTE_STACK_KEY = 'rcMusicRouteStack'
function readRouteStack() { try { const value = JSON.parse(sessionStorage.getItem(ROUTE_STACK_KEY) || 'null'); return Array.isArray(value) && value.length ? value : [{ screen: 'home', activeEvent: null }] } catch { return [{ screen: 'home', activeEvent: null }] } }
function writeRouteStack(stack) { try { sessionStorage.setItem(ROUTE_STACK_KEY, JSON.stringify(stack.slice(-20))) } catch {} }
function routeHash(screen) { return `#${screen || 'home'}` }

export default function App() {
  const [screen, setScreen] = useState(() => {
    try {
      // Conserva la ruta actual al volver desde OAuth, una recarga o el botón
      // atrás del dispositivo. Solo la primera entrada real comienza en Home.
      return window.location.hash.slice(1) || window.history.state?.screen || readRouteStack().at(-1)?.screen || 'home'
    } catch { return 'home' }
  })
  const screenRef = useRef(screen)
  const [activeEvent, setActiveEvent] = useState(() => {
    try { return window.history.state?.activeEvent || readRouteStack().at(-1)?.activeEvent || null } catch { return null }
  })
  const [developerLogin, setDeveloperLogin] = useState(false)
  const [djSession, setDjSession] = useState(() => getStoredDjSession())
  const [developerSession, setDeveloperSession] = useState(null)

  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  useEffect(() => {
    // Inicializa la demo o una sesión anónima de Supabase.
    getEvents()
    if (supabaseEnabled) ensureAnonymousSession().catch(() => {})
    try {
      if (sessionStorage.getItem('rc_pending_recovery_v1')) setScreen('dj-login')
    } catch {}
  }, [])

  useEffect(() => {
    if (screen === 'dj') {
      try { localStorage.removeItem('rc_drive_return_screen') } catch {}
    }
  }, [screen])

  useEffect(() => {
    const current = window.history.state
    const stack = readRouteStack()
    writeRouteStack(stack)
    const initial = stack.at(-1) || { screen: 'home', activeEvent: null }
    if (!current?.[HISTORY_KEY]) {
      window.history.replaceState({ ...current, [HISTORY_KEY]: true, screen: initial.screen, activeEvent: initial.activeEvent || null, routeIndex: stack.length - 1, appRoot: stack.length === 1 }, '', routeHash(initial.screen))
    }

    const restorePreviousRoute = (event) => {
      const state = event?.state || window.history.state
      const currentScreen = screenRef.current
      const routes = readRouteStack()
      const currentIndex = Math.max(0, routes.map((route) => route.screen).lastIndexOf(currentScreen))
      const previous = currentIndex > 0 ? routes[currentIndex - 1] : null
      if (previous && currentScreen !== 'home') {
        const trimmed = routes.slice(0, currentIndex)
        writeRouteStack(trimmed)
        const previousState = { ...(state || {}), [HISTORY_KEY]: true, screen: previous.screen, activeEvent: previous.activeEvent || null, routeIndex: currentIndex - 1, appRoot: currentIndex - 1 === 0 }
        window.history.replaceState(previousState, '', routeHash(previous.screen))
        setScreen(previous.screen)
        setActiveEvent(previous.activeEvent || null)
        return
      }
      const hashScreen = window.location.hash.slice(1)
      if (state?.[HISTORY_KEY] || hashScreen) {
        const nextScreen = hashScreen || state.screen || 'home'
        setScreen(nextScreen)
        setActiveEvent(state?.activeEvent || null)
      }
    }

    window.addEventListener('popstate', restorePreviousRoute)
    window.addEventListener('hashchange', restorePreviousRoute)
    return () => { window.removeEventListener('popstate', restorePreviousRoute); window.removeEventListener('hashchange', restorePreviousRoute) }
  }, [])

  function navigate(nextScreen, nextEvent = null) {
    const current = window.history.state
    if (current?.[HISTORY_KEY] && current.screen === nextScreen && current.activeEvent?.id === nextEvent?.id) return
    const routes = readRouteStack()
    const currentIndex = Math.max(0, routes.map((route) => route.screen).lastIndexOf(screenRef.current))
    const nextRoutes = [...routes.slice(0, currentIndex + 1), { screen: nextScreen, activeEvent: nextEvent }]
    writeRouteStack(nextRoutes)
    const state = { ...(current || {}), [HISTORY_KEY]: true, screen: nextScreen, activeEvent: nextEvent, routeIndex: nextRoutes.length - 1, appRoot: false }
    window.history.pushState(state, '', routeHash(nextScreen))
    setActiveEvent(nextEvent)
    setScreen(nextScreen)
  }

  function goBack() {
    if (window.history.state?.[HISTORY_KEY] && window.history.state.screen !== 'home') {
      window.history.back()
    }
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
    if (window.history.state?.[HISTORY_KEY]) {
      window.history.replaceState({ ...window.history.state, activeEvent: nextEvent }, '', window.location.href)
    }
  }

  if (screen === 'attendee-join') return <JoinEvent onBack={goBack} onJoin={(event) => navigate('attendee', event)} />
  if (screen === 'attendee' && activeEvent) return <AttendeeApp event={activeEvent} onUpdate={updateEvent} onExit={goBack} />
  if (screen === 'dj-login') return <DjLogin developerMode={developerLogin} onBack={goBack} onLogin={(access) => { if (developerLogin) { setDeveloperSession(access); navigate('developer') } else { setDjSession(access); navigate('dj') } }} />
  if (screen === 'developer' && developerSession) return <AdminPanel session={developerSession} onClose={goBack} />
  if (screen === 'dj') return <DjApp session={djSession} onExit={goBack} />
  return <HomeScreen onAttendee={() => navigate('attendee-join')} onDj={() => { setDeveloperLogin(false); navigate('dj-login') }} />
}
