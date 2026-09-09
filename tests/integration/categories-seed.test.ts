import { createClient } from '@supabase/supabase-js'
import { describe, it, expect } from 'vitest'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!

describe('default categories seed', () => {
  it('gives a new user exactly the 4 default categories', async () => {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const ts = Date.now()
    const { error } = await client.auth.signUp({
      email: `luccasmadia07+seed-${ts}@gmail.com`,
      password: 'password123',
    })
    if (error) throw error

    const { data: categories, error: catError } = await client.from('categories').select('nome')
    if (catError) throw catError

    expect(categories).toHaveLength(4)
    expect(categories?.map((c) => c.nome).sort()).toEqual([
      'Estudos',
      'Lazer',
      'Trabalho',
      'Treino/Saúde',
    ])
  })
})
