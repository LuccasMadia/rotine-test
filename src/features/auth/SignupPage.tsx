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
    <form onSubmit={handleSubmit}>
      <h1>Criar conta</h1>
      <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        type="password"
        placeholder="senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={6}
        required
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Criar conta</button>
      <Link to="/login">Já tenho conta</Link>
    </form>
  )
}
