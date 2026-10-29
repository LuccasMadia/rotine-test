import { useEffect, useState } from 'react'
import Icon from '../../ui/Icon'
import PageHeader from '../../ui/PageHeader'
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
    <div className="page">
      <PageHeader title="Configurações" backTo="/" />
      <div className="stack">
        {supported ? (
          <label className="card share-card">
            <Icon name="bell" size={24} />
            <span className="share-card__text">
              <strong>Lembretes no horário</strong>
              <span className="muted">Uma notificação quando chegar a hora de cada item.</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              aria-label="Lembretes no horário"
              checked={enabled}
              onChange={handleToggle}
            />
          </label>
        ) : (
          <div className="card">
            <strong>Este navegador não permite notificações.</strong>
          </div>
        )}
        <p className="muted">
          No iPhone, os lembretes só funcionam com o app adicionado à Tela de Início (iOS 16.4 ou
          mais novo).
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
