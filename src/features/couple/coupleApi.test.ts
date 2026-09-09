import { describe, it, expect, vi } from 'vitest'
import { createCouple, getPartnerId, joinCouple } from './coupleApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => {
  const single = vi.fn().mockResolvedValue({ data: { code: 'ABC123' }, error: null })
  const insertSelect = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })
  const updateSelect = vi.fn().mockResolvedValue({ data: [{ code: 'ABC123' }], error: null })
  const eq = vi.fn().mockReturnValue({ select: updateSelect })
  const update = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ insert, update })
  const rpc = vi.fn().mockResolvedValue({ data: 'partner-user-id', error: null })
  return { supabase: { from, rpc } }
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

  it('joinCouple throws when no row matches the code (invalid, already used, or own code)', async () => {
    const from = vi.mocked(supabase.from)
    const updateSelect = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ select: updateSelect })
    const update = vi.fn().mockReturnValue({ eq })
    from.mockReturnValueOnce({ update } as unknown as ReturnType<typeof supabase.from>)

    await expect(joinCouple('user-b-id', 'BADCODE')).rejects.toThrow(
      'Código inválido ou já utilizado.'
    )
  })

  it('getPartnerId calls the partner_id RPC with the given user id', async () => {
    const result = await getPartnerId('user-a-id')
    expect(supabase.rpc).toHaveBeenCalledWith('partner_id', { uid: 'user-a-id' })
    expect(result).toBe('partner-user-id')
  })
})
