import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
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
    <div>
      <h1>Conectar com seu par</h1>
      <section>
        <button onClick={handleCreate}>Criar código de casal</button>
        {generatedCode && <p>Compartilhe este código: {generatedCode}</p>}
      </section>
      <section>
        <input
          placeholder="Código recebido"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
        />
        <button onClick={handleJoin}>Entrar com código</button>
      </section>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
