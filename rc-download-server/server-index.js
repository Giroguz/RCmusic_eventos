import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const port = Number(process.env.PORT || 8787)
const supabaseUrl = process.env.SUPABASE_URL || 'https://fzqpmpgbubpmongodcat.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
app.use(cors({ origin: '*', credentials: false }))
app.use(express.json())
async function rpc(name, body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message || data?.error_description || 'Supabase request failed')
  return data
}
app.get('/health', (_req, res) => res.json({ ok: true, service: 'rc-music-eventos-api' }))
app.post('/api/dj/login', async (req, res) => { try { res.json(await rpc('dj_login', { p_email: String(req.body?.email || '').trim().toLowerCase(), p_code: String(req.body?.code || '').trim() })) } catch (error) { res.status(400).json({ error: error.message }) } })
app.post('/api/dj/access', async (req, res) => { try { res.json(await rpc('dj_check_access', { p_token: String(req.body?.token || '') })) } catch (error) { res.status(400).json({ error: error.message }) } })
app.post('/api/dj/events', async (req, res) => { try { res.json(await rpc('dj_get_events', { p_token: String(req.body?.token || '') })) } catch (error) { res.status(400).json({ error: error.message }) } })
app.listen(port, () => console.log(`RC music_eventos API escuchando en el puerto ${port}`))
