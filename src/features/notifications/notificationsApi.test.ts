import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from './notificationsApi'
import { supabase } from '../../lib/supabaseClient'

vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BEXAMPLEKEYBASE64URLSAFEVALUEFORTESTS1234567890')

vi.mock('../../lib/supabaseClient', () => {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const deleteEq = vi.fn().mockResolvedValue({ error: null })
  const del = vi.fn().mockReturnValue({ eq: deleteEq })
  const from = vi.fn().mockReturnValue({ upsert, delete: del })
  return { supabase: { from } }
})

function mockServiceWorker(pushManager: Record<string, unknown>) {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  })
}

describe('notificationsApi', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockClear()
  })

  it('getExistingSubscription returns the current subscription', async () => {
    const fakeSub = { endpoint: 'https://push.example/1' }
    mockServiceWorker({ getSubscription: vi.fn().mockResolvedValue(fakeSub) })

    const result = await getExistingSubscription()
    expect(result).toBe(fakeSub)
  })

  it('subscribeToPush throws when permission is denied', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') })
    mockServiceWorker({ subscribe: vi.fn() })

    await expect(subscribeToPush('user-a')).rejects.toThrow('Permissão de notificação negada')
  })

  it('subscribeToPush saves the subscription when permission is granted', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
    const fakeSub = { toJSON: () => ({ endpoint: 'https://push.example/1' }) }
    mockServiceWorker({ subscribe: vi.fn().mockResolvedValue(fakeSub) })

    await expect(subscribeToPush('user-a')).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions')
  })

  it('unsubscribeFromPush unsubscribes and deletes the row', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true)
    mockServiceWorker({ getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) })

    await expect(unsubscribeFromPush('user-a')).resolves.toBeUndefined()
    expect(unsubscribe).toHaveBeenCalled()
    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions')
  })

  it('unsubscribeFromPush is a no-op on the browser side when there is no active subscription', async () => {
    mockServiceWorker({ getSubscription: vi.fn().mockResolvedValue(null) })

    await expect(unsubscribeFromPush('user-a')).resolves.toBeUndefined()
    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions')
  })

  it('isPushSupported reflects browser capability', () => {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', {})
    mockServiceWorker({})

    expect(isPushSupported()).toBe(true)
  })
})
