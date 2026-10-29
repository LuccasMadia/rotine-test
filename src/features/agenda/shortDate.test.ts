import { describe, expect, it } from 'vitest'
import { shortDate } from './AgendaPage'

describe('shortDate', () => {
  it.each([
    ['2026-10-25', '25 out'],
    ['2026-10-31', '31 out'],
    ['2026-11-29', '29 nov'],
    ['2026-12-05', '5 dez'],
    ['2026-12-20', '20 dez'],
    ['2026-12-26', '26 dez'],
  ])('%s -> %s', (iso, out) => expect(shortDate(iso)).toBe(out))
})
