import { createClient } from '@supabase/supabase-js'
import { describe, it, expect } from 'vitest'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!

async function signUp(email: string, password: string) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  return { client, userId: data.user!.id }
}

describe('notification_log RLS', () => {
  it('a regular user cannot insert into notification_log', async () => {
    const ts = Date.now()
    const a = await signUp(`luccasmadia07+a-notiflog-${ts}@gmail.com`, 'password123')

    const { data: category } = await a.client
      .from('categories')
      .insert({ user_id: a.userId, nome: 'Treino', cor: '#000', icone: 'dumbbell' })
      .select()
      .single()

    const { data: item } = await a.client
      .from('routine_items')
      .insert({
        user_id: a.userId,
        category_id: category!.id,
        titulo: 'Alongar',
        data_inicio: '2026-09-10',
        horario: '09:00',
        is_shared: false,
      })
      .select()
      .single()

    const { error } = await a.client.from('notification_log').insert({
      routine_item_id: item!.id,
      user_id: a.userId,
      occurrence_date: '2026-09-10',
    })

    expect(error).not.toBeNull()
  })
})

describe('push_subscriptions unique constraint', () => {
  it('upserting by user_id overwrites the previous subscription instead of adding a row', async () => {
    const ts = Date.now()
    const a = await signUp(`luccasmadia07+a-pushsub-${ts}@gmail.com`, 'password123')

    await a.client
      .from('push_subscriptions')
      .insert({ user_id: a.userId, subscription_json: { endpoint: 'https://push.example/old' } })

    await a.client
      .from('push_subscriptions')
      .upsert(
        { user_id: a.userId, subscription_json: { endpoint: 'https://push.example/new' } },
        { onConflict: 'user_id' },
      )

    const { data: rows } = await a.client
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', a.userId)

    expect(rows).toHaveLength(1)
    expect(rows![0].subscription_json.endpoint).toBe('https://push.example/new')
  })
})
