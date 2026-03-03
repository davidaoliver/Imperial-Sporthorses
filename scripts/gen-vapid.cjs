const wp = require('web-push');
const vapid = wp.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + vapid.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapid.privateKey);
