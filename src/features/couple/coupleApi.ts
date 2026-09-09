import { supabase } from '../../lib/supabaseClient'

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function createCouple(userId: string): Promise<{ code: string }> {
  const code = generateCode()
  const { data, error } = await supabase
    .from('couples')
    .insert({ user_a: userId, code })
    .select('code')
    .single()
  if (error) throw error
  return { code: data.code }
}

export async function joinCouple(userId: string, code: string): Promise<void> {
  const { data, error } = await supabase
    .from('couples')
    .update({ user_b: userId })
    .eq('code', code)
    .select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Código inválido ou já utilizado.')
  }
}
