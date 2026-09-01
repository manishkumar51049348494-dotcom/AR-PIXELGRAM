/**
 * Delete karne ke baad kabhi-kabhi post/reel refresh par wapas aa jaati thi
 * (server par delete fail hua ya CDN/replica ne purana data diya). Yahan hum
 * delete ki hui id ko phone me yaad rakhte hain aur har list se hata dete hain,
 * isliye delete ki hui cheez dobara kabhi nahi dikhti.
 */
const KEY_POSTS = 'ar_deleted_post_ids';
const KEY_REELS = 'ar_deleted_reel_ids';

function read(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function write(key: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    // Sirf last 500 ids rakho taaki storage bhare nahi.
    window.localStorage.setItem(key, JSON.stringify([...ids].slice(-500)));
  } catch {
    /* storage full — ignore */
  }
}

export function markPostDeleted(id: string): void {
  const ids = read(KEY_POSTS);
  ids.add(id);
  write(KEY_POSTS, ids);
}

export function markReelDeleted(id: string): void {
  const ids = read(KEY_REELS);
  ids.add(id);
  write(KEY_REELS, ids);
}

export function filterDeletedPosts<T extends { id: string }>(rows: T[]): T[] {
  const ids = read(KEY_POSTS);
  return ids.size ? rows.filter((r) => !ids.has(r.id)) : rows;
}

export function filterDeletedReels<T extends { id: string }>(rows: T[]): T[] {
  const ids = read(KEY_REELS);
  return ids.size ? rows.filter((r) => !ids.has(r.id)) : rows;
}
