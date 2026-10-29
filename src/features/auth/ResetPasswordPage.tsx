import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { authErrorMessage } from './authErrorMessage'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Link vencido ou já usado: o Supabase redireciona com #error=... na URL.
  const [expired, setExpired] = useState(() => window.location.hash.includes('error='))
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // O link do e-mail abre esta tela já com uma sessão temporária; sem ela, o link expirou ou já foi usado.
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      setExpired(true)
      return
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(authErrorMessage(error))
      return
    }
    navigate('/')
  }

  return (
    <form className="page auth" onSubmit={handleSubmit}>
      <h1>Criar senha nova</h1>
      <label className="field">
        <span>Nova senha</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={6}
          aria-describedby="nova-senha-hint"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <p id="nova-senha-hint" className="muted">Mínimo de 6 caracteres.</p>
      {expired && (
        <p role="alert" className="error">
          Esse link expirou ou já foi usado.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary">Salvar nova senha</button>
      {expired && <Link className="btn btn--text" to="/esqueci-senha">Pedir um novo link</Link>}
    </form>
  )
}
