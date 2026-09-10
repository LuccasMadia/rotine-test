import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '../notifications/notificationsApi'

export default function SettingsPage() {
  const { user } = useAuth()
  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false)
      return
    }
    getExistingSubscription().then((subscription) => setEnabled(subscription !== null))
  }, [])

  async function handleToggle() {
    if (!user) return
    setError(null)
    try {
      if (enabled) {
        await unsubscribeFromPush(user.id)
        setEnabled(false)
      } else {
        await subscribeToPush(user.id)
        setEnabled(true)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <h1>Configurações</h1>
      <nav>
        <Link to="/">Hoje</Link>
      </nav>
      {!supported && (
        <p>
          Notificações não são suportadas neste navegador. No iPhone, é preciso iOS 16.4+ e ter
          instalado o app na tela inicial antes de ativar.
        </p>
      )}
      {supported && (
        <label>
          <input type="checkbox" checked={enabled} onChange={handleToggle} />
          Notificações
        </label>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
