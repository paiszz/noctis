// Noctis Service Worker (PWA & Push Foundation)
// Strictly non-intrusive: Never caches user private data, API responses, or Supabase Auth.

const CACHE_NAME = 'noctis-pwa-v1';

const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.ico',
];

// Offline HTML fallback banner for navigation when completely offline
const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0F766E" />
  <title>Offline — Noctis</title>
  <style>
    :root {
      --bg: #F7F8F6;
      --surface: #FFFFFF;
      --primary: #0F766E;
      --primary-dark: #115E59;
      --soft-accent: #E8F3EF;
      --text: #202923;
      --muted: #69746C;
      --border: rgba(15, 118, 110, 0.15);
      --card-shadow: 0 10px 30px -5px rgba(15, 118, 110, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0C130F;
        --surface: #141D18;
        --primary: #14B8A6;
        --primary-dark: #0F766E;
        --soft-accent: rgba(20, 184, 166, 0.15);
        --text: #F0F4F1;
        --muted: #94A399;
        --border: rgba(20, 184, 166, 0.2);
        --card-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5);
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Urbanist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
      -webkit-font-smoothing: antialiased;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .brand-logo {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, #0F766E 0%, #115E59 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25);
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .card {
      background: var(--surface);
      padding: 36px 28px;
      border-radius: 24px;
      box-shadow: var(--card-shadow);
      max-width: 440px;
      width: 100%;
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .icon-container {
      width: 60px;
      height: 60px;
      border-radius: 20px;
      background: var(--soft-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 18px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--soft-accent);
      color: var(--primary);
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 5px 14px;
      border-radius: 9999px;
      margin-bottom: 14px;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary);
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin-bottom: 10px;
      color: var(--text);
    }
    p {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.6;
      margin-bottom: 24px;
      max-width: 360px;
    }
    .status-box {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #D97706;
      display: inline-block;
    }
    .status-dot.online {
      background: #10B981;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: var(--primary);
      color: #FFFFFF;
      border: none;
      padding: 12px 28px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 9999px;
      cursor: pointer;
      transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 2px 8px rgba(15, 118, 110, 0.25);
      text-decoration: none;
      width: 100%;
    }
    .btn:hover {
      background: var(--primary-dark);
      box-shadow: 0 4px 14px rgba(15, 118, 110, 0.35);
    }
    .btn:active {
      transform: scale(0.98);
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .footer-note {
      margin-top: 24px;
      font-size: 12px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="brand">
    <div class="brand-logo">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
    </div>
    <span class="brand-name">Noctis</span>
  </div>

  <div class="card">
    <div class="icon-container">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
    </div>

    <div class="badge">
      <span class="badge-dot"></span>
      Mode Luar Jaringan
    </div>

    <h1>Koneksi Internet Terputus</h1>
    <p>Aplikasi Noctis sedang tidak dapat terhubung ke jaringan. Jika Anda menggunakan mode tamu, seluruh data jadwal, tugas, dan catatan Anda tetap tersimpan aman di perangkat ini.</p>

    <div class="status-box">
      <span id="status-dot" class="status-dot"></span>
      <span id="status-text">Menunggu jaringan kembali...</span>
    </div>

    <button id="reload-btn" class="btn" onclick="retryConnection()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
        <path d="M16 16h5v5"/>
      </svg>
      Coba Muat Ulang
    </button>
  </div>

  <div class="footer-note">Noctis — Your Personal Productivity Space</div>

  <script>
    function retryConnection() {
      var btn = document.getElementById('reload-btn');
      var dot = document.getElementById('status-dot');
      var text = document.getElementById('status-text');
      if (btn) btn.disabled = true;
      if (text) text.textContent = 'Memeriksa konektivitas...';

      if (navigator.onLine) {
        if (dot) dot.className = 'status-dot online';
        if (text) text.textContent = 'Koneksi terdeteksi! Memuat ulang...';
        setTimeout(function() { window.location.reload(); }, 350);
      } else {
        setTimeout(function() {
          if (btn) btn.disabled = false;
          if (text) text.textContent = 'Perangkat masih di luar jaringan.';
        }, 700);
      }
    }

    window.addEventListener('online', function() {
      var dot = document.getElementById('status-dot');
      var text = document.getElementById('status-text');
      if (dot) dot.className = 'status-dot online';
      if (text) text.textContent = 'Koneksi pulih! Memuat ulang otomatis...';
      setTimeout(function() { window.location.reload(); }, 600);
    });
  </script>
</body>
</html>`;

// 1. Install event: pre-cache static icons & manifest
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Message event: handle explicit instructions from client (e.g. SKIP_WAITING)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 3. Activate event: clean up outdated Noctis PWA caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('noctis-pwa-') && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch event: conservative caching for static assets only
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // DO NOT INTERCEPT:
  // - Supabase API or database requests
  // - Internal Next.js API routes (/api/)
  // - Auth pages (/login, /register, /auth/)
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/login' ||
    url.pathname === '/register'
  ) {
    return;
  }

  // Handle HTML document navigation with Network-First strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        return new Response(OFFLINE_FALLBACK_HTML, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      })
    );
    return;
  }

  // Handle static assets (_next/static, public/icons, manifest, fonts) with Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/screenshots/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// 4. Web Push Notification Handlers (PRD v1.2 Foundation)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let title = 'Pengingat Noctis';
  let options = {
    body: 'Anda memiliki aktivitas yang perlu diperhatikan.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: '/dashboard' },
  };

  try {
    const payload = event.data.json();
    if (payload.title) title = payload.title;
    if (payload.body) options.body = payload.body;
    if (payload.icon) options.icon = payload.icon;
    if (payload.url) options.data.url = payload.url;
  } catch {
    options.body = event.data.text() || options.body;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
