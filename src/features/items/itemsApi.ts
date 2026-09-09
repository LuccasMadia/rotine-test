import { supabase } from '../../lib/supabaseClient'
import type { RecurrenceEnd, RecurrenceRule } from '../../lib/recurrence'

export type Priority = 'alta' | 'media' | 'baixa'

export type RoutineItem = {
  id: string
  user_id: string
  category_id: string
  titulo: string
  notas: string | null
  prioridade: Priority
  data_inicio: string
  horario: string
  is_shared: boolean
  recurrence_rule: RecurrenceRule
  recurrence_end: RecurrenceEnd
  created_at: string
}

export type RoutineItemInput = {
  category_id: string
  titulo: string
  notas: string | null
  prioridade: Priority
  data_inicio: string
  horario: string
  is_shared: boolean
  recurrence_rule: RecurrenceRule
  recurrence_end: RecurrenceEnd
}

export async function listItems(): Promise<RoutineItem[]> {
  const { data, error } = await supabase
    .from('routine_items')
    .select('*')
    .order('data_inicio', { ascending: true })
  if (error) throw error
  return data
}

export async function getItem(id: string): Promise<RoutineItem> {
  const { data, error } = await supabase.from('routine_items').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createItem(userId: string, input: RoutineItemInput): Promise<RoutineItem> {
  const { data, error } = await supabase
    .from('routine_items')
    .insert({ user_id: userId, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateItem(id: string, input: RoutineItemInput): Promise<RoutineItem> {
  const { data, error } = await supabase
    .from('routine_items')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('routine_items').delete().eq('id', id)
  if (error) throw error
}
