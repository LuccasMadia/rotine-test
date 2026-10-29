import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  return (
    <form className="page auth" onSubmit={handleSubmit}>
      <div className="auth__mark" aria-hidden="true">
        <i />
        <i />
      </div>
      <p className="brand">Rotina do Casal</p>
      <p className="muted">O dia de vocês dois, marcado num toque.</p>
      <h1>Entrar</h1>
      <label className="field">
        <span>E-mail</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="field">
        <span>Senha</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary">Entrar</button>
      <Link className="btn btn--text" to="/signup">Criar conta</Link>
    </form>
  )
}
