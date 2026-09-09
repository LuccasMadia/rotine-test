import { describe, it, expect, vi } from 'vitest'
import { createCouple, joinCouple } from './coupleApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => {
  const single = vi.fn().mockResolvedValue({ data: { code: 'ABC123' }, error: null })
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ insert, update })
  return { supabase: { from } }
})

describe('coupleApi', () => {
  it('createCouple inserts a couple row and returns its code', async () => {
    const result = await createCouple('user-a-id')
    expect(supabase.from).toHaveBeenCalledWith('couples')
    expect(result.code).toBe('ABC123')
  })

  it('joinCouple updates the couple row matching the code', async () => {
    await joinCouple('user-b-id', 'ABC123')
    expect(supabase.from).toHaveBeenCalledWith('couples')
  })
})
