import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OccurrenceRow from './OccurrenceRow'
import type { Occurrence } from '../../lib/occurrences'

function make(over: { titulo?: string; is_shared?: boolean; partner?: boolean } = {}): Occurrence {
  return {
    item: {
      id: 'i1',
      titulo: over.titulo ?? 'Academia',
      horario: '07:00:00',
      is_shared: over.is_shared ?? false,
      recurrence_rule: { type: 'daily' },
      category_id: 'c1',
    },
    date: '2026-10-29',
    ownCompletion: false,
    partnerCompletion: over.partner ?? false,
  } as unknown as Occurrence
}

const renderRow = (o: Occurrence, onToggle = vi.fn()) =>
  render(
    <ul>
      <OccurrenceRow occurrence={o} onToggle={onToggle} categoryColor="#ff0000" />
    </ul>,
  )

describe('OccurrenceRow', () => {
  it('uses the item title as the checkbox accessible name', () => {
    renderRow(make())
    expect(screen.getByRole('checkbox', { name: /Academia/ })).toBeTruthy()
  })

  it('calls onToggle with the occurrence when tapped', () => {
    const o = make()
    const onToggle = vi.fn()
    renderRow(o, onToggle)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith(o)
  })

  it('shows the partner status only for shared items', () => {
    const { unmount } = renderRow(make({ is_shared: true, partner: true }))
    expect(screen.getByText(/Par:/).parentElement?.textContent).toMatch(/Par: feito/)
    unmount()
    renderRow(make({ is_shared: false }))
    expect(screen.queryByText(/Par:/)).toBeNull()
  })

  it('keeps a long title intact', () => {
    const titulo = 'Revisar proposta do cliente X antes da reunião de sexta '.padEnd(80, 'x')
    renderRow(make({ titulo }))
    expect(screen.getByText(titulo)).toBeTruthy()
  })

  it('shows HH:MM without seconds', () => {
    renderRow(make())
    expect(screen.getByText(/07:00 ·/)).toBeTruthy()
    expect(screen.queryByText(/07:00:00/)).toBeNull()
  })
})
