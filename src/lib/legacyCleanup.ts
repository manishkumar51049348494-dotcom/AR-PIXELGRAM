/**
 * Purane (band ho chuke) Supabase project par pade media wale post/reel.
 *
 * Un rows ka media host ab exist hi nahi karta, isliye photo safed aur reel
 * kaali dikhti thi. Do kaam yahan hote hain:
 *
 * 1. Har feed/list se aise rows turant hata diye jaate hain (server delete ka
 *    intezaar kiye bina) — kisi ko broken content nahi dikhega.
 * 2. Jab owner logged-in ho, uske apne broken rows database se sach me delete
 *    kar diye jaate hain (RLS owner ko delete allow karta hai).
 */
import { supabase } from '@/db/supabase';
import { isLegacyMediaUrl } from '@/lib/mediaUrl';

type LegacyPost = { id: string; image_url?: string | null; video_url?: string | null };
type LegacyReel = { id: string; video_url?: string | null; thumbnail_url?: string | null };

export function isLegacyPost(p: LegacyPost): boolean {
  return isLegacyMediaUrl(p.image_url) || isLegacyMediaUrl(p.video_url);
}

export function isLegacyReel(r: LegacyReel): boolean {
  return isLegacyMediaUrl(r.video_url);
}

export function dropLegacyPosts<T extends LegacyPost>(rows: T[]): T[] {
  return rows.filter((r) => !isLegacyPost(r));
}

export function dropLegacyReels<T extends LegacyReel>(rows: T[]): T[] {
  return rows.filter((r) => !isLegacyReel(r));
}

let purged = false;

/**
 * Logged-in user ke apne broken post/reel database se delete karo. Ek session
 * me sirf ek baar chalta hai aur koi bhi error chup-chaap ignore hota hai —
 * yeh sirf safai hai, app flow kabhi block nahi karega.
 */
export async function purgeLegacyMediaForUser(userId?: string | null): Promise<void> {
  if (!userId || purged) return;
  purged = true;
  try {
    const [{ data: posts }, { data: reels }] = await Promise.all([
      supabase.from('posts').select('id, image_url').eq('user_id', userId),
      supabase.from('reels').select('id, video_url').eq('user_id', userId),
    ]);

    const badPosts = (posts || []).filter((p) => isLegacyPost(p as LegacyPost)).map((p) => p.id);
    const badReels = (reels || []).filter((r) => isLegacyReel(r as LegacyReel)).map((r) => r.id);

    if (badPosts.length) await supabase.from('posts').delete().in('id', badPosts);
    if (badReels.length) await supabase.from('reels').delete().in('id', badReels);
  } catch {
    /* safai fail hui to bhi UI filter broken content chhupa deta hai */
  }
}
