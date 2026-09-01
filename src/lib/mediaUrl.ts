import { supabase } from '@/db/supabase';

/**
 * Purane post / reel ka media kabhi-kabhi load nahi hota. Do wajah hoti hain:
 *
 * 1. Media isi project me hai lekin bucket/CDN setting ki wajah se public URL
 *    fail karta hai — uska hal signed URL hai (niche resolveMediaUrl).
 * 2. Media PURANE (ab band ho chuke) Supabase project par pada tha. Uska host
 *    ab exist hi nahi karta, isliye photo safed aur reel kaali dikhti thi.
 *    Aise media ko hum pehchan kar saaf message dikhate hain, taaki user ko
 *    khali safed/kaala box na dikhe.
 */
const cache = new Map<string, string>();

const CURRENT_HOST = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL as string).host;
  } catch {
    return '';
  }
})();

/** Kya yeh media kisi purane/band Supabase project ka hai? */
export function isLegacyMediaUrl(url?: string | null): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const host = new URL(url).host;
    if (!host.endsWith('.supabase.co') && !host.endsWith('.supabase.in')) return false;
    return CURRENT_HOST !== '' && host !== CURRENT_HOST;
  } catch {
    return false;
  }
}

function parsePublicUrl(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

/** Signed URL (7 din) — fail hone par null. */
export async function resolveMediaUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  if (isLegacyMediaUrl(url)) return null;
  const cached = cache.get(url);
  if (cached) return cached;
  const parsed = parsePublicUrl(url);
  if (!parsed) return null;
  try {
    const { data } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, 60 * 60 * 24 * 7);
    if (!data?.signedUrl) return null;
    cache.set(url, data.signedUrl);
    return data.signedUrl;
  } catch {
    return null;
  }
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
