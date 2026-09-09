import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

function Probe() {
  const { user, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{user ? 'logged-in' : 'logged-out'}</div>
}

describe('AuthContext', () => {
  it('starts loading, then resolves to logged-out with no session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    expect(screen.getByText('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('logged-out')).toBeInTheDocument())
    expect(supabase.auth.getSession).toHaveBeenCalled()
  })
})
