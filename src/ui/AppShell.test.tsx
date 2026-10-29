import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import AppShell from './AppShell'

function setup() {
  render(
    <MemoryRouter initialEntries={['/agenda']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/agenda" element={<p>conteúdo</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  it('shows the four tabs with visible labels', () => {
    setup()
    for (const n of ['Hoje', 'Agenda', 'Estatísticas', 'Itens'])
      expect(screen.getByRole('link', { name: n })).toBeInTheDocument()
  })
  it('marks the current tab', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Hoje' })).not.toHaveAttribute('aria-current')
  })
  it('renders the routed page', () => {
    setup()
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
  })
})
