// Pooja's HQ — Service Worker
// Handles background push nudges every 6 hours

const CACHE_NAME = 'poojas-hq-v4';
const NOTIF_ICON = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" rx="40" fill="%23F4B6C2"/><text x="90" y="130" font-size="120" text-anchor="middle" fill="%23C4607A">P</text></svg>';

const NUDGE_MSGS_PENDING = [
  { t: 'Psst, Pooja… 👀', b: 'Your to-do list is giving you the look. A little love goes a long way!' },
  { t: 'Hey superwoman! 🦸‍♀️', b: "A few things are still waiting on you — you've totally got this. Let's knock 'em out!" },
  { t: 'Quick check-in 💅', b: "Some tasks are sitting there like, \"Pooja? Helloooo?\" 😄 Go show 'em who's boss!" },
  { t: 'Not to be that friend… 😂', b: "But your list misses you. Just a few things left — you'll feel SO good after!" },
  { t: 'Pooja, babe! 🌸', b: "Don't let those tasks pile up — a quick peek at your list and you're golden ✨" },
  { t: 'Your list is calling 📲', b: "It's giving 'please notice me' energy 😄 Hop in and clear a few — you're on fire!" },
];

const NUDGE_MSGS_OVERDUE = [
  { t: 'Okay okay okay, Pooja! 😅', b: "Some things are getting a liiittle overdue. Nothing you can't handle — let's go! 💪" },
  { t: 'Girl, your tasks are drama 🎭', b: "They've been waiting. You know what to do — go be the legend you are!" },
  { t: 'SOS from your to-do list 🚨', b: "A couple things really want your attention. You've handled harder stuff — easy win!" },
  { t: 'Pooja! The tasks texted. 😂', b: "They said 'still here bestie' — go handle it like the queen you are 👑" },
];

const NUDGE_MSGS_CLEAR = [
  { t: 'You cleared it ALL, Pooja!! 🎉', b: 'Zero pending. Zero drama. Just you, thriving. Take a moment and soak it in 💖' },
  { t: 'Empty list = full heart 💗', b: "Nothing pending! You're an absolute force. Go enjoy your day!" },
  { t: 'Inbox zero achieved ✨', b: "Honestly? Not everyone could do this. You did. Treat yourself!" },
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Install & Activate ──
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// ── Message from app ──
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NUDGES') {
    scheduleNudge();
  }
});

// ── Periodic background sync (Android Chrome) ──
self.addEventListener('periodicsync', e => {
  if (e.tag === 'nudge-check') {
    e.waitUntil(fireNudge());
  }
});

// ── Schedule next nudge alarm ──
function scheduleNudge() {
  // Fire once now if needed, then every 6.5 hours via setTimeout
  // (foreground scheduling handled by app itself)
  fireNudge();
}

// ── Read state from IndexedDB and fire notification ──
async function fireNudge() {
  try {
    const data = await getNudgeData();
    if (!data || !data.notifEnabled) return;

    const { total = 0, overdue = 0 } = data;
    let msg;
    if (total === 0) {
      msg = pickRandom(NUDGE_MSGS_CLEAR);
    } else if (overdue > 0) {
      msg = pickRandom(NUDGE_MSGS_OVERDUE);
    } else {
      msg = pickRandom(NUDGE_MSGS_PENDING);
    }

    await self.registration.showNotification(msg.t, {
      body: msg.b,
      icon: NOTIF_ICON,
      badge: NOTIF_ICON,
      tag: 'poojas-hq-nudge',
      renotify: true,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: '✅ Open App' }
      ]
    });
  } catch (e) {
    console.log('SW nudge error', e);
  }
}

// ── Read nudge data from IndexedDB ──
function getNudgeData() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('poojas-hq-sw', 1);
      req.onupgradeneeded = ev => ev.target.result.createObjectStore('kv');
      req.onsuccess = ev => {
        const db = ev.target.result;
        try {
          const tx = db.transaction('kv', 'readonly');
          const get = tx.objectStore('kv').get('nudge-data');
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      };
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

// ── Notification click → open app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('My-Hq-App') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('https://pooga17.github.io/My-Hq-App/');
    })
  );
});
