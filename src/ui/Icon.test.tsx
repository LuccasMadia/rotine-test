import { render } from '@testing-library/react'
import Icon from './Icon'

describe('Icon', () => {
  it('renders an aria-hidden svg at the requested size', () => {
    const { container } = render(<Icon name="check" size={16} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('width')).toBe('16')
    expect(svg.getAttribute('height')).toBe('16')
    expect(svg.getAttribute('stroke')).toBe('currentColor')
  })
})
