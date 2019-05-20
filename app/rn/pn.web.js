import uint8ArrayToUrlBase64 from '../util/uint8ArrayToUrlBase64';

export const getPnToken = async () => {
  const sw = await navigator.serviceWorker.ready;
  const sub =
    (await sw.pushManager.getSubscription()) ||
    (await sw.pushManager.subscribe({
      userVisibleOnly: true,
    }));
  return {
    endpoint: sub.endpoint,
    p256dh: uint8ArrayToUrlBase64(sub.getKey('p256dh')),
    auth: uint8ArrayToUrlBase64(sub.getKey('auth')),
  };
};
// polyfill for native ./pn.ios|android.js
export const registerPn = () => {
  return;
};
