import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

// O link de "esqueci minha senha" pode abrir o app instalado (PWA) em outra página; aqui garantimos a tela de senha nova.
export default function RecoveryRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/nova-senha', { replace: true })
    })
    return () => data.subscription.unsubscribe()
  }, [navigate])

  return null
}
