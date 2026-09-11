import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char))
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await request.json()
    const adminToken = String(body.adminToken || '')
    const to = String(body.to || '').trim().toLowerCase()
    const displayName = String(body.displayName || 'DJ')
    const code = String(body.code || '').trim()
    const planLabel = String(body.planLabel || 'plan contratado')
    const expiresAt = body.expiresAt ? String(body.expiresAt) : ''
    if (!adminToken || !to || !code) throw new Error('Missing email data')

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { error: adminError } = await supabase.rpc('admin_list_djs', { p_token: adminToken })
    if (adminError) throw new Error('Admin validation failed')

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
    const from = Deno.env.get('RESEND_FROM_EMAIL') || 'RC music_eventos <onboarding@resend.dev>'
    const expiryLine = expiresAt ? `<p>Vigente hasta: <strong>${escapeHtml(new Date(expiresAt).toLocaleString('es-PE'))}</strong></p>` : ''
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Tu acceso al Panel de DJ · RC music_eventos',
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17121f"><h2>Acceso activado</h2><p>Hola ${escapeHtml(displayName)}, tu pago fue verificado y tu acceso ya está activo.</p><p>Plan: <strong>${escapeHtml(planLabel)}</strong></p>${expiryLine}<p>Tu código único de ingreso es:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;background:#f1f5f9;padding:12px 16px;display:inline-block">${escapeHtml(code)}</p><p>Guárdalo y no lo compartas. Úsalo junto con tu correo para ingresar al Panel de DJ.</p><p>RC music_eventos</p></div>`,
      }),
    })
    if (!response.ok) throw new Error(`Resend rejected email: ${await response.text()}`)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Email failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
