import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Icon from '../../ui/Icon'
import { createCouple, joinCouple } from './coupleApi'

export default function CoupleSetupPage() {
  const { user } = useAuth()
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleCreate() {
    if (!user) return
    setError(null)
    try {
      const { code } = await createCouple(user.id)
      setGeneratedCode(code)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleJoin() {
    if (!user) return
    setError(null)
    try {
      await joinCouple(user.id, joinCode.trim().toUpperCase())
      navigate('/')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="page">
      <div className="stack">
        <Icon name="couple" size={32} />
        <h1>Conectar com seu par</h1>
        <p className="muted">Um de vocês cria o código e o outro digita. Só precisa fazer uma vez.</p>
        <section className="card form">
          <h2 className="group-title">Vou criar o código</h2>
          {generatedCode && (
            <div className="code-box" aria-live="polite">
              <strong>{generatedCode}</strong>
              <span className="muted">Mande este código para seu par.</span>
            </div>
          )}
          <button type="button" className="btn btn--secondary" onClick={handleCreate}>
            Criar código
          </button>
        </section>
        <p className="divider">ou</p>
        <section className="card form">
          <h2 className="group-title">Recebi um código</h2>
          <label className="field">
            <span>Código do seu par</span>
            <input
              autoCapitalize="characters"
              autoComplete="off"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn--primary" onClick={handleJoin}>
            Conectar
          </button>
        </section>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Link className="btn btn--text" to="/">
          Fazer depois
        </Link>
      </div>
    </div>
  )
}
