const MESSAGES: Record<string, string> = {
  // Supabase não diz qual campo errou, de propósito: evita descobrir quais e-mails têm conta.
  invalid_credentials: 'E-mail ou senha incorretos. Confira os dois e tente de novo.',
  email_not_confirmed: 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  user_already_exists: 'Já existe uma conta com esse e-mail. Tente entrar.',
  email_exists: 'Já existe uma conta com esse e-mail. Tente entrar.',
  weak_password: 'Senha fraca: use pelo menos 6 caracteres.',
  email_address_invalid: 'Esse e-mail não parece válido.',
  validation_failed: 'Confira o e-mail e a senha.',
  over_request_rate_limit: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.',
  over_email_send_rate_limit: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.',
  signup_disabled: 'Novos cadastros estão desativados no momento.',
  same_password: 'A senha nova precisa ser diferente da atual.',
  session_not_found: 'Esse link expirou ou já foi usado. Peça um novo.',
}

export function authErrorMessage(error: { code?: string; message: string }): string {
  return (error.code && MESSAGES[error.code]) || 'Não deu certo. Tente de novo em instantes.'
}
