const [chatOpen, setChatOpen] = useState(false)
  useEffect(() => {
    const handlePopState = (historyEvent) => setChatOpen(Boolean(historyEvent.state?.rcMusicChat))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  function openChat() {
    if (!window.history.state?.rcMusicChat) window.history.pushState({ ...window.history.state, rcMusicChat: true }, '', window.location.href)
    setChatOpen(true)
  }
  function closeChat() {
    if (window.history.state?.rcMusicChat) { window.history.back(); return }
    setChatOpen(false)
  }
