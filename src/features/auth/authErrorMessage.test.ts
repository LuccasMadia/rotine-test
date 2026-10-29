import { describe, it, expect } from 'vitest'
import { authErrorMessage } from './authErrorMessage'

describe('authErrorMessage', () => {
  it('explains wrong credentials without revealing which field is wrong', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'E-mail ou senha incorretos. Confira os dois e tente de novo.',
    )
  })

  it('translates signup errors', () => {
    expect(authErrorMessage({ code: 'weak_password', message: 'x' })).toBe('Senha fraca: use pelo menos 6 caracteres.')
    expect(authErrorMessage({ code: 'email_address_invalid', message: 'x' })).toBe('Esse e-mail não parece válido.')
  })

  it('falls back to a generic Portuguese message for unknown codes', () => {
    expect(authErrorMessage({ code: 'something_new', message: 'Boom' })).toBe('Não deu certo. Tente de novo em instantes.')
    expect(authErrorMessage({ message: 'Failed to fetch' })).toBe('Não deu certo. Tente de novo em instantes.')
  })
})
