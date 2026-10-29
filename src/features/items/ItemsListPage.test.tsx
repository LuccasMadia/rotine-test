import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import ItemsListPage from './ItemsListPage'

vi.mock('./itemsApi', () => ({
  listItems: vi.fn().mockResolvedValue([
    {
      id: 'i1',
      category_id: 'c1',
      titulo: 'Academia',
      horario: '07:30:00',
      data_inicio: '2026-10-01',
      is_shared: true,
      recurrence_rule: { type: 'daily' },
      recurrence_end: { type: 'never' },
    },
  ]),
}))
vi.mock('../categories/categoriesApi', () => ({
  listCategories: vi.fn().mockResolvedValue([{ id: 'c1', nome: 'Saúde', cor: '#ff0000' }]),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ItemsListPage />
    </MemoryRouter>,
  )
}

describe('ItemsListPage', () => {
  it('links each item to its edit screen', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: 'Editar Academia' })
    expect(link).toHaveAttribute('href', '/items/i1/edit')
  })

  it('does not offer delete in the list', async () => {
    renderPage()
    await screen.findByRole('link', { name: 'Editar Academia' })
    expect(screen.queryByRole('button', { name: /Excluir/ })).toBeNull()
  })

  it('links to categories', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'Categorias' })).toHaveAttribute('href', '/categories')
  })
})
