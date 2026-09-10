import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

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

describe('routine_items RLS', () => {
  it('user A cannot see user B personal item', async () => {
    const ts = Date.now()
    const a = await signUp(`luccasmadia07+a-rls-${ts}@gmail.com`, 'password123')
    const b = await signUp(`luccasmadia07+b-rls-${ts}@gmail.com`, 'password123')

    const { data: category } = await b.client
      .from('categories')
      .insert({ user_id: b.userId, nome: 'Estudos', cor: '#000', icone: 'book' })
      .select()
      .single()

    await b.client.from('routine_items').insert({
      user_id: b.userId,
      category_id: category!.id,
      titulo: 'Item pessoal de B',
      data_inicio: '2026-08-12',
      horario: '09:00',
      is_shared: false,
    })

    const { data: seenByA } = await a.client.from('routine_items').select('*')
    expect(seenByA).toEqual([])
  })

  it('partner can see and edit a shared item', async () => {
    const ts = Date.now()
    const code = `code-${ts}`
    const a = await signUp(`luccasmadia07+a-shared-${ts}@gmail.com`, 'password123')
    const b = await signUp(`luccasmadia07+b-shared-${ts}@gmail.com`, 'password123')

    await a.client.from('couples').insert({ code, user_a: a.userId })
    await b.client.from('couples').update({ user_b: b.userId }).eq('code', code)

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
        titulo: 'Academia juntos',
        data_inicio: '2026-08-12',
        horario: '18:00',
        is_shared: true,
      })
      .select()
      .single()

    const { data: seenByB } = await b.client.from('routine_items').select('*').eq('id', item!.id)
    expect(seenByB).toHaveLength(1)

    const { error: updateError } = await b.client
      .from('routine_items')
      .update({ titulo: 'Academia juntos (editado por B)' })
      .eq('id', item!.id)
    expect(updateError).toBeNull()
  })

  it('partner cannot edit a personal (non-shared) item', async () => {
    const ts = Date.now()
    const code = `code-${ts}`
    const a = await signUp(`luccasmadia07+a-personal-${ts}@gmail.com`, 'password123')
    const b = await signUp(`luccasmadia07+b-personal-${ts}@gmail.com`, 'password123')

    await a.client.from('couples').insert({ code, user_a: a.userId })
    await b.client.from('couples').update({ user_b: b.userId }).eq('code', code)

    const { data: category } = await a.client
      .from('categories')
      .insert({ user_id: a.userId, nome: 'Trabalho', cor: '#000', icone: 'briefcase' })
      .select()
      .single()

    const { data: item } = await a.client
      .from('routine_items')
      .insert({
        user_id: a.userId,
        category_id: category!.id,
        titulo: 'Reunião pessoal',
        data_inicio: '2026-08-12',
        horario: '10:00',
        is_shared: false,
      })
      .select()
      .single()

    const { data: updateResult, error: updateError } = await b.client
      .from('routine_items')
      .update({ titulo: 'Alterado por B' })
      .eq('id', item!.id)
      .select()

    expect(updateError).toBeNull()
    expect(updateResult).toEqual([])
  })

  it('user cannot see another user\'s category', async () => {
    const ts = Date.now()
    const a = await signUp(`luccasmadia07+a-cat-${ts}@gmail.com`, 'password123')
    const b = await signUp(`luccasmadia07+b-cat-${ts}@gmail.com`, 'password123')

    await b.client
      .from('categories')
      .insert({ user_id: b.userId, nome: 'Estudos', cor: '#000', icone: 'book' })

    const { data: seenByA } = await a.client.from('categories').select('*').eq('user_id', b.userId)
    expect(seenByA).toEqual([])
  })

  it('user can see partner category only when used by a shared item', async () => {
    const ts = Date.now()
    const code = `code-${ts}`
    const a = await signUp(`luccasmadia07+a-partnercat-${ts}@gmail.com`, 'password123')
    const b = await signUp(`luccasmadia07+b-partnercat-${ts}@gmail.com`, 'password123')

    await a.client.from('couples').insert({ code, user_a: a.userId })
    await b.client.from('couples').update({ user_b: b.userId }).eq('code', code)

    const { data: sharedCategory } = await b.client
      .from('categories')
      .insert({ user_id: b.userId, nome: 'Compartilhada', cor: '#000', icone: 'star' })
      .select()
      .single()

    const { data: privateCategory } = await b.client
      .from('categories')
      .insert({ user_id: b.userId, nome: 'PrivadaDeB', cor: '#000', icone: 'lock' })
      .select()
      .single()

    await b.client.from('routine_items').insert({
      user_id: b.userId,
      category_id: sharedCategory!.id,
      titulo: 'Item compartilhado de B',
      data_inicio: '2026-08-12',
      horario: '09:00',
      is_shared: true,
    })

    const { data: seenByA } = await a.client.from('categories').select('*').eq('user_id', b.userId)

    expect(seenByA).toHaveLength(1)
    expect(seenByA![0].id).toBe(sharedCategory!.id)
    expect(seenByA!.some((category) => category.id === privateCategory!.id)).toBe(false)
  })
})
