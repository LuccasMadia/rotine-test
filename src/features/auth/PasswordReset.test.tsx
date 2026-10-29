import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ForgotPasswordPage from './ForgotPasswordPage'
import ResetPasswordPage from './ResetPasswordPage'

const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
}))
vi.mock('../../lib/supabaseClient', () => ({ supabase: { auth } }))

beforeEach(() => vi.clearAllMocks())

describe('ForgotPasswordPage', () => {
  it('sends the reset link back to /nova-senha and shows a neutral confirmation', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByText(/Se existir uma conta com esse e-mail/)).toBeInTheDocument()
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', {
      redirectTo: `${window.location.origin}/nova-senha`,
    })
  })

  it('shows a translated error when the request fails', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', message: 'x' } })
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas seguidas')
  })
})

function renderReset() {
  render(
    <MemoryRouter initialEntries={['/nova-senha']}>
      <Routes>
        <Route path="/nova-senha" element={<ResetPasswordPage />} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'segredo123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
}

describe('ResetPasswordPage', () => {
  it('saves the new password and goes to Hoje', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: {} } } })
    auth.updateUser.mockResolvedValue({ error: null })
    renderReset()

    expect(await screen.findByText('home')).toBeInTheDocument()
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'segredo123' })
  })

  it('explains an expired link instead of trying to save', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    renderReset()

    expect(await screen.findByRole('alert')).toHaveTextContent('link expirou')
    await waitFor(() => expect(auth.updateUser).not.toHaveBeenCalled())
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute('href', '/esqueci-senha')
  })
})
