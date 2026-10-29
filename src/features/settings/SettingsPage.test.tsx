import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsPage from './SettingsPage'
import { getPartnerId } from '../couple/coupleApi'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../couple/coupleApi', () => ({ getPartnerId: vi.fn() }))
vi.mock('../notifications/notificationsApi', () => ({
  isPushSupported: () => true,
  getExistingSubscription: vi.fn().mockResolvedValue(null),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

describe('SettingsPage couple card', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links to couple setup when there is no partner', async () => {
    vi.mocked(getPartnerId).mockResolvedValue(null)
    renderPage()
    const link = await screen.findByRole('link', { name: /Conectar com seu par/ })
    expect(link).toHaveAttribute('href', '/couple-setup')
  })

  it('hides the card when a partner exists', async () => {
    vi.mocked(getPartnerId).mockResolvedValue('u2')
    renderPage()
    await screen.findByText('Lembretes no horário')
    await Promise.resolve()
    expect(screen.queryByRole('link', { name: /Conectar com seu par/ })).toBeNull()
  })
})
