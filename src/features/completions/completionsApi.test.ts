import { describe, it, expect, vi } from 'vitest'
import { listCompletions, markComplete, unmarkComplete } from './completionsApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => {
  const sampleRow = {
    id: 'completion-1',
    routine_item_id: 'item-1',
    user_id: 'user-a',
    data: '2026-01-05',
    completed_at: '2026-01-05T10:00:00Z',
  }

  const lte = vi.fn().mockResolvedValue({ data: [sampleRow], error: null })
  const gte = vi.fn().mockReturnValue({ lte })
  const select = vi.fn().mockReturnValue({ gte })

  const insert = vi.fn().mockResolvedValue({ error: null })

  const deleteEqData = vi.fn().mockResolvedValue({ error: null })
  const deleteEqItem = vi.fn().mockReturnValue({ eq: deleteEqData })
  const del = vi.fn().mockReturnValue({ eq: deleteEqItem })

  const from = vi.fn().mockReturnValue({ select, insert, delete: del })
  return { supabase: { from } }
})

describe('completionsApi', () => {
  it('listCompletions returns completions within the date range', async () => {
    const result = await listCompletions('2026-01-01', '2026-01-31')
    expect(supabase.from).toHaveBeenCalledWith('item_completions')
    expect(result).toHaveLength(1)
    expect(result[0].routine_item_id).toBe('item-1')
  })

  it('markComplete inserts a completion row', async () => {
    await expect(markComplete('user-a', 'item-1', '2026-01-05')).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith('item_completions')
  })

  it('markComplete swallows a unique-violation error (already marked)', async () => {
    const from = vi.mocked(supabase.from)
    const insert = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    from.mockReturnValueOnce({ insert } as unknown as ReturnType<typeof supabase.from>)

    await expect(markComplete('user-a', 'item-1', '2026-01-05')).resolves.toBeUndefined()
  })

  it('markComplete rethrows non-unique-violation errors', async () => {
    const from = vi.mocked(supabase.from)
    const insert = vi.fn().mockResolvedValue({ error: { code: '42501', message: 'permission denied' } })
    from.mockReturnValueOnce({ insert } as unknown as ReturnType<typeof supabase.from>)

    await expect(markComplete('user-a', 'item-1', '2026-01-05')).rejects.toMatchObject({ code: '42501' })
  })

  it('unmarkComplete deletes the matching completion row', async () => {
    await expect(unmarkComplete('item-1', '2026-01-05')).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith('item_completions')
  })
})
