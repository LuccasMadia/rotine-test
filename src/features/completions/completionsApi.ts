import { supabase } from '../../lib/supabaseClient'

export type ItemCompletion = {
  id: string
  routine_item_id: string
  user_id: string
  data: string
  completed_at: string
}

const UNIQUE_VIOLATION = '23505'

export async function listCompletions(startDate: string, endDate: string): Promise<ItemCompletion[]> {
  const { data, error } = await supabase
    .from('item_completions')
    .select('*')
    .gte('data', startDate)
    .lte('data', endDate)
  if (error) throw error
  return data
}

export async function markComplete(userId: string, routineItemId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('item_completions')
    .insert({ user_id: userId, routine_item_id: routineItemId, data: date })
  if (error && error.code !== UNIQUE_VIOLATION) throw error
}

export async function unmarkComplete(routineItemId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('item_completions')
    .delete()
    .eq('routine_item_id', routineItemId)
    .eq('data', date)
  if (error) throw error
}
