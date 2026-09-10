import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

type PushPayload = { title?: string; body?: string; itemId?: string }

self.addEventListener('push', (event: PushEvent) => {
  const data: PushPayload = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Rotina', {
      body: data.body,
      data: { itemId: data.itemId },
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const itemId = (event.notification.data as { itemId?: string } | undefined)?.itemId
  const url = itemId ? `/items/${itemId}/edit` : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((client): client is WindowClient => 'focus' in client)
      if (existing) {
        return existing.focus().then(() => existing.navigate(url))
      }
      return self.clients.openWindow(url)
    }),
  )
})
