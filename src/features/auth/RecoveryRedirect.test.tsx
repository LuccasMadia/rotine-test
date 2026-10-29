import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import RecoveryRedirect from './RecoveryRedirect'

const auth = vi.hoisted(() => ({ onAuthStateChange: vi.fn() }))
vi.mock('../../lib/supabaseClient', () => ({ supabase: { auth } }))

describe('RecoveryRedirect', () => {
  it('sends the user to /nova-senha when they arrive through a recovery link on any page', () => {
    let listener: (event: string) => void = () => {}
    auth.onAuthStateChange.mockImplementation((cb) => {
      listener = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <RecoveryRedirect />
        <Routes>
          <Route path="/" element={<p>hoje</p>} />
          <Route path="/nova-senha" element={<p>nova senha</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('hoje')).toBeInTheDocument()

    act(() => listener('PASSWORD_RECOVERY'))

    expect(screen.getByText('nova senha')).toBeInTheDocument()
  })
})
