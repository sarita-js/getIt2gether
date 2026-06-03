// ── GetIt2gether Service Worker ───────────────────────────────────────────────
// Caches the app shell so the UI loads instantly and works offline.
// Firebase Auth + Firestore still need a network connection to sync,
// but the app itself will open and display cached tasks even offline.

const CACHE_NAME = 'git2g-v1';

// App shell — all the files that make the UI work
const PRECACHE_URLS = [
  '/splash.html',
  '/auth.html',
  '/app.html',
  '/styles.css',
  '/firebase-config.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── INSTALL: cache the app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clear old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fall back to network ─────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Firebase API calls — always go straight to network
  if (
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return; // let the browser handle it normally
  }

  // For everything else: cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses for future offline use
        if (
          event.request.method === 'GET' &&
          response.status === 200 &&
          response.type !== 'opaque'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (future-ready) ────────────────────────────────────────
// The app currently uses the Web Notifications API directly.
// This handler is here if you later want to send server-side push notifications
// via Firebase Cloud Messaging.
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'GetIt2gether', {
    body:    data.body    || 'You have tasks waiting.',
    icon:    data.icon    || '/icons/icon-192.png',
    badge:   data.badge   || '/icons/icon-192.png',
    tag:     data.tag     || 'git2g-push',
    data:    data.url     || '/app.html',
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/app.html')
  );
});