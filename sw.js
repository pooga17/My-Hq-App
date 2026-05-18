// Pooja's HQ — Service Worker for background nudges
const CACHE = "poojas-hq-v1";

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

// Listen for scheduled alarm messages from the app
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NUDGES') {
    scheduleAlarms();
  }
});

function getState() {
  return new Promise(resolve => {
    // Read from IndexedDB (shared with main app via a simple key)
    const req = indexedDB.open('poojas-hq-sw', 1);
    req.onupgradeneeded = ev => ev.target.result.createObjectStore('kv');
    req.onsuccess = ev => {
      const db = ev.target.result;
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const get = store.get('nudge-data');
      get.onsuccess = () => resolve(get.result || {total: 0, overdue: 0});
      get.onerror = () => resolve({total: 0, overdue: 0});
    };
    req.onerror = () => resolve({total: 0, overdue: 0});
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(list => {
    if (list.length > 0) return list[0].focus();
    return clients.openWindow('/');
  }));
});

// Periodic check every hour via sync (Chrome) or just rely on app open
self.addEventListener('periodicsync', e => {
  if (e.tag === 'nudge-check') {
    e.waitUntil(checkAndNudge());
  }
});

async function checkAndNudge() {
  const data = await getState();
  const now = new Date();
  const h = now.getHours();
  const today = now.toDateString();
  const firedKey = 'fired-' + today;

  const req = indexedDB.open('poojas-hq-sw', 1);
  req.onsuccess = ev => {
    const db = ev.target.result;
    const tx = db.transaction('kv', 'readwrite');
    const store = tx.objectStore('kv');
    const getFired = store.get(firedKey);
    getFired.onsuccess = () => {
      const fired = getFired.result || {};
      let type = null;
      if (h >= 8 && h < 9 && !fired.morning) { type = 'morning'; fired.morning = true; }
      else if (h >= 13 && h < 14 && !fired.midday) { type = 'midday'; fired.midday = true; }
      else if (h >= 20 && h < 21 && !fired.evening) { type = 'evening'; fired.evening = true; }
      if (type) {
        store.put(fired, firedKey);
        fireNotification(type, data.total || 0, data.overdue || 0);
      }
    };
  };
}

function fireNotification(type, total, overdue) {
  const ICON = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" rx="40" fill="%23F4B6C2"/><text x="90" y="130" font-size="120" text-anchor="middle" fill="%23C4607A">P</text></svg>';
  let title, body;
  if (type === 'morning') {
    title = "Good morning, Pooja! ☀️";
    body = total === 0 ? "You're all clear — enjoy your day!" :
           overdue > 0 ? `${overdue} overdue + ${total} total open. Let's go! 💪` :
           `${total} item${total>1?'s':''} waiting today. You've got this!`;
  } else if (type === 'midday') {
    title = "Midday check-in 🌸";
    body = total === 0 ? "Inbox zero! You're unstoppable, Pooja." :
           overdue > 0 ? `${overdue} overdue — quick, you can knock these out!` :
           `${total} still open. How's your afternoon looking?`;
  } else {
    title = "Evening wrap-up 🌙";
    body = total === 0 ? "Everything done today! Amazing, Pooja. 🎉" :
           `${total} item${total>1?'s':''} still open. You need to finish up! 💪`;
  }
  self.registration.showNotification(title, {
    body, icon: ICON, badge: ICON, tag: 'poojas-hq-' + type,
    renotify: true, vibrate: [200, 100, 200]
  });
}
