// APK ke andar live website load karta hai, taaki har naya deploy
// automatic app me aa jaye (dobara APK install karne ki zarurat nahi).
const CONFIG_URL =
  'https://raw.githubusercontent.com/manishkumar51049348494-dotcom/AR-PIXELGRAM/main/public/app-url.txt';
const FALLBACK_URL = 'https://ar-pixelgram.vercel.app';

function isNativeApk() {
  const p = window.location.protocol;
  return p === 'file:' || p === 'capacitor:' || p === 'http:' && window.location.hostname === 'localhost';
}

async function pick(url: string) {
  try {
    const r = await fetch(url, { method: 'GET', cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

export async function bootLiveWebsite() {
  if (!isNativeApk()) return;
  if (sessionStorage.getItem('live-boot-tried') === '1') return;
  sessionStorage.setItem('live-boot-tried', '1');

  let target = FALLBACK_URL;
  try {
    const res = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const txt = (await res.text()).trim();
      if (/^https?:\/\//.test(txt)) target = txt.split(/\s+/)[0];
    }
  } catch {
    /* offline -> bundled app chalta rahega */
  }

  if (await pick(target)) {
    window.location.replace(target);
  }
}
