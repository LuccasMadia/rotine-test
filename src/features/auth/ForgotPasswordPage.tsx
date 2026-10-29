import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { authErrorMessage } from './authErrorMessage'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    })
    if (error) {
      setError(authErrorMessage(error))
      return
    }
    setSent(true)
  }

  return (
    <form className="page auth" onSubmit={handleSubmit}>
      <h1>Esqueci minha senha</h1>
      {sent ? (
        // Mesma mensagem exista ou não a conta, para não revelar quais e-mails estão cadastrados.
        <p role="status">
          Se existir uma conta com esse e-mail, enviamos um link para criar uma senha nova. Confira a caixa de entrada e o
          spam.
        </p>
      ) : (
        <>
          <p className="muted">Digite seu e-mail e enviamos um link para você criar uma senha nova.</p>
          <label className="field">
            <span>E-mail</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary">Enviar link</button>
        </>
      )}
      <Link className="btn btn--text" to="/login">Voltar para entrar</Link>
    </form>
  )
}
