import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      return
    }
    navigate('/couple-setup')
  }

  return (
    <form className="page auth" onSubmit={handleSubmit}>
      <div className="auth__mark" aria-hidden="true">
        <i />
        <i />
      </div>
      <p className="brand">Rotina do Casal</p>
      <p className="muted">O dia de vocês dois, marcado num toque.</p>
      <h1>Criar conta</h1>
      <label className="field">
        <span>E-mail</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="field">
        <span>Senha</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <span className="muted">Mínimo de 6 caracteres.</span>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary">Criar conta</button>
      <Link className="btn btn--text" to="/login">Já tenho conta</Link>
    </form>
  )
}
