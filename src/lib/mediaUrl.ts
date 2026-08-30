import { supabase } from '@/db/supabase';

/**
 * Purane post / reel ka media kabhi-kabhi load nahi hota (bucket setting ya
 * CDN cache ke wajah se) — tab screen kaali dikhti thi. Yahan se hum usi
 * object ka signed URL bana kar dobara try karte hain, isliye kitne bhi
 * purana video/photo ho, waise hi dikhta hai jaise upload hua tha.
 */
const cache = new Map<string, string>();

function parsePublicUrl(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

/** Signed URL (7 din) — fail hone par null. */
export async function resolveMediaUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  const cached = cache.get(url);
  if (cached) return cached;
  const parsed = parsePublicUrl(url);
  if (!parsed) return null;
  const { data } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, 60 * 60 * 24 * 7);
  if (!data?.signedUrl) return null;
  cache.set(url, data.signedUrl);
  return data.signedUrl;
}

/**
 * <img>/<video> ke onError me lagao — ek hi baar retry karta hai taki
 * infinite loop na bane.
 */
export function retryMediaOnError(
  el: HTMLImageElement | HTMLVideoElement,
  originalUrl?: string | null,
): void {
  if (el.dataset.mediaRetried === '1') return;
  el.dataset.mediaRetried = '1';
  resolveMediaUrl(originalUrl || el.getAttribute('src'))
    .then((signed) => {
      if (signed) el.src = signed;
    })
    .catch(() => {});
}
