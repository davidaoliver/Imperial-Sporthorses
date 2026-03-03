const CACHE_NAME = 'imperial-v6'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// Handle notification messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data
    self.registration.showNotification(title, {
      body,
      icon: '/notif-icon.png',
      badge: '/notif-badge.png',
      tag: tag || 'barn-alert',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
    })
  }
})

// Handle notification click — focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus()
      }
      return self.clients.openWindow('/')
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = event.request.url

  // Never intercept Supabase API calls or auth redirects
  if (url.includes('supabase.co') || url.includes('supabase.com')) return
  if (url.includes('accounts.google.com')) return
  if (url.includes('access_token') || url.includes('code=')) return

  // Navigation requests (HTML pages) — always go to network
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
