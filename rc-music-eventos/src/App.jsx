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
    const currentScreen = screenRef.current
    const currentEvent = activeEvent || null
    const savedRoutes = readRouteStack()
    // La entrada inicial debe representar la pantalla que realmente está abierta.
    // Antes se usaba siempre la última ruta guardada y eso podía reemplazar la
    // ruta actual por Home al pulsar Atrás después de una recarga.
    const savedLast = savedRoutes.at(-1)
    const stack = savedLast?.screen === currentScreen
      ? savedRoutes
      : [{ screen: currentScreen || 'home', activeEvent: currentEvent }]
    writeRouteStack(stack)
    if (!current?.[HISTORY_KEY]) {
      window.history.replaceState({ ...current, [HISTORY_KEY]: true, screen: currentScreen || 'home', activeEvent: currentEvent, routeIndex: stack.length - 1, appRoot: stack.length === 1 }, '', routeHash(currentScreen))
    }

    const syncRouteFromHistory = (event) => {
      const state = event?.state || window.history.state
      if (state?.[HISTORY_KEY]) {
        const routes = readRouteStack()
        const routeIndex = Number.isInteger(state.routeIndex) ? state.routeIndex : routes.length - 1
        writeRouteStack(routes.slice(0, Math.max(0, routeIndex) + 1))
        setScreen(state.screen || 'home')
        setActiveEvent(state.activeEvent || null)
        return
      }
      // Si el navegador sale de la pila de la app, vuelve a una pantalla
      // coherente con el hash, sin forzar un salto adicional a Home.
      const hashScreen = window.location.hash.slice(1)
      setScreen(hashScreen || 'home')
      setActiveEvent(null)
      writeRouteStack([{ screen: hashScreen || 'home', activeEvent: null }])
    }

    // pushState + Atrás dispara popstate. No escuchamos hashchange aquí para
    // evitar procesar dos veces la misma navegación y saltarnos una página.
    window.addEventListener('popstate', syncRouteFromHistory)
    return () => window.removeEventListener('popstate', syncRouteFromHistory)
  }, [])

  function navigate(nextScreen, nextEvent = null) {
    const current = window.history.state
    if (current?.[HISTORY_KEY] && current.screen === nextScreen && current.activeEvent?.id === nextEvent?.id) return
    const routes = readRouteStack()
    const storedIndex = Number.isInteger(current?.routeIndex) ? current.routeIndex : routes.length - 1
    const currentIndex = Math.max(0, Math.min(storedIndex, routes.length - 1))
    const nextRoutes = [...routes.slice(0, currentIndex + 1), { screen: nextScreen, activeEvent: nextEvent }]
    writeRouteStack(nextRoutes)
    const state = { ...(current || {}), [HISTORY_KEY]: true, screen: nextScreen, activeEvent: nextEvent, routeIndex: nextRoutes.length - 1, appRoot: false }
    window.history.pushState(state, '', routeHash(nextScreen))
    setActiveEvent(nextEvent)
    setScreen(nextScreen)
  }

  function goBack() {
    const state = window.history.state
    if (state?.[HISTORY_KEY] && Number.isInteger(state.routeIndex) && state.routeIndex > 0) {
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
