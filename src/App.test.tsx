import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App'

vi.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

describe('App', () => {
  it('renders without crashing, redirecting an unauthenticated user to the login form', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })
})
