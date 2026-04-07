import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = 'BFMIGD7VybJjnBKevJZ3tbHedEQcHEVXtH0weKu0ONUHvmziV8TEepmvervwJW7Km3Tu2eS8EavBsRtXTdO73yE'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Subscribe the current user to push notifications and store in Supabase
export async function subscribeToPush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Not supported in this browser')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription()

    // Unsubscribe old subscription if it exists (VAPID key may have changed)
    if (subscription) {
      try {
        await subscription.unsubscribe()
        console.log('[Push] Cleared old subscription')
      } catch (e) {
        console.warn('[Push] Failed to unsubscribe old:', e)
      }
      subscription = null
    }

    if (!subscription) {
      // Request permission and subscribe
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.log('[Push] Permission denied')
        return null
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    // Store/update subscription in Supabase
    const subJson = subscription.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

    if (error) {
      console.error('[Push] Failed to store subscription:', error)
    } else {
      console.log('[Push] Subscription stored')
    }

    return subscription
  } catch (err) {
    console.error('[Push] Subscribe error:', err)
    return null
  }
}

// Send push notification to all subscribers via Netlify Function
export async function sendPushAlert(title, message) {
  // Fetch all push subscriptions from Supabase
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (error || !subs || subs.length === 0) {
    console.warn('[Push] No subscriptions found:', error)
    return { sent: 0 }
  }

  // Format subscriptions for web-push
  const subscriptions = subs.map((s) => ({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }))

  // Call Netlify Function
  const response = await fetch('/.netlify/functions/send-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message, subscriptions }),
  })

  const result = await response.json()
  console.log('[Push] Send result:', result)

  // Clean up expired subscriptions
  if (result.expired && result.expired.length > 0) {
    for (const endpoint of result.expired) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
  }

  return result
}
