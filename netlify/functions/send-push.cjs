const webpush = require('web-push');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'VAPID keys not configured' }) };
  }

  webpush.setVapidDetails(
    `mailto:${VAPID_EMAIL || 'admin@imperialsporthorses.com'}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { title, message, subscriptions } = body;

  if (!title || !message || !subscriptions || !subscriptions.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing title, message, or subscriptions' }) };
  }

  const payload = JSON.stringify({
    title,
    body: message,
    icon: '/notif-icon.png',
    badge: '/notif-badge.png',
    tag: 'barn-alert-' + Date.now(),
    data: { url: '/' },
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(sub, payload).catch((err) => {
        // 410 = subscription expired, 404 = not found
        if (err.statusCode === 410 || err.statusCode === 404) {
          return { expired: true, endpoint: sub.endpoint };
        }
        throw err;
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  const expired = results
    .filter((r) => r.status === 'fulfilled' && r.value?.expired)
    .map((r) => r.value.endpoint);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sent, failed, expired }),
  };
};
