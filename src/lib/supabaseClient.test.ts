import { describe, it, expect, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

describe('supabaseClient', () => {
  it('creates a client without throwing', async () => {
    const { supabase } = await import('./supabaseClient')
    expect(supabase).toBeDefined()
  })
})
