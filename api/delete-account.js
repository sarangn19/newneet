import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
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
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token', detail: authErr?.message })
    const userId = user.id

    const tables = ['user_stats','topic_scores','question_history','revision_schedule','lesson_progress','battle_history','notes','chat_history','daily_stats']
    for (const table of tables) {
      try { await admin.from(table).delete().eq('user_id', userId) } catch {}
    }
    try { await admin.from('battle_rooms').delete().eq('player1_id', userId) } catch {}
    try { await admin.from('battle_rooms').delete().eq('player2_id', userId) } catch {}
    try { await admin.from('matchmaking_queue').delete().eq('user_id', userId) } catch {}
    try { await admin.from('users').delete().eq('id', userId) } catch {}
    if (user?.email) {
      try { await admin.from('blocked_emails').upsert({ email: user.email, blocked_at: new Date().toISOString() }, { onConflict: 'email' }) } catch {}
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) return res.status(500).json({ error: 'Delete failed', detail: delErr.message })

    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: 'Internal error', detail: e.message })
  }
}
