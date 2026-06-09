import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' })
  const token = authHeader.slice(7)

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ievtwzygmpluzrltzdmr.supabase.co'
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return res.status(500).json({ error: 'Missing SERVICE_ROLE_KEY' })

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const email = user.email
  if (!email) return res.status(200).json({ blocked: false })

  const { data } = await admin.from('blocked_emails').select('email').eq('email', email).maybeSingle()
  return res.status(200).json({ blocked: !!data })
}
