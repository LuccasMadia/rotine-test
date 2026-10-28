import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// registerType 'autoUpdate': a versão nova assume na hora em vez de esperar fechar todas as abas
self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// Rotas do React Router (/agenda, /items/:id/edit…) abrem offline e a partir da notificação
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

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
