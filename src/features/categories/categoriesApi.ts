import { supabase } from '../../lib/supabaseClient'

export type Category = {
  id: string
  user_id: string
  nome: string
  cor: string
  icone: string
  created_at: string
}

export type CategoryInput = {
  nome: string
  cor: string
  icone: string
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('nome')
  if (error) throw error
  return data
}

export async function createCategory(userId: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, ...input })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}
