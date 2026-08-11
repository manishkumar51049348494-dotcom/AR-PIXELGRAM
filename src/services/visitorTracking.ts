import { supabase } from '@/db/supabase';

export interface VisitorSession {
  id: string;
  user_id: string | null;
  username: string | null;
  ip: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  device_name: string | null;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  is_pwa: boolean | null;
  path: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface RegisteredVisitor {
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  email?: string | null;
  last_sign_in_at?: string | null;
  updated_at?: string | null;
}

const db = supabase as any;

/* ---------------- Device / OS / Browser detection ---------------- */
export function detectDevice() {
  const ua = navigator.userAgent || '';
  const isTablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(ua);
  const isMobile = /Android|iPhone|iPod|Windows Phone|webOS|BlackBerry/i.test(ua);
  const device_type = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let os = 'Unknown';
  if (/Android[ /]([\d.]+)/i.test(ua)) os = `Android ${RegExp.$1}`;
  else if (/(iPhone|iPad|iPod).*OS ([\d_]+)/i.test(ua)) os = `iOS ${RegExp.$2.replace(/_/g, '.')}`;
  else if (/Windows NT ([\d.]+)/i.test(ua)) os = `Windows ${RegExp.$1 === '10.0' ? '10/11' : RegExp.$1}`;
  else if (/Mac OS X ([\d_]+)/i.test(ua)) os = `macOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser\//i.test(ua)) browser = 'Samsung Internet';
  else if (/Chrome\/([\d.]+)/i.test(ua) && !/Chromium/i.test(ua)) browser = `Chrome ${RegExp.$1.split('.')[0]}`;
  else if (/Firefox\/([\d.]+)/i.test(ua)) browser = `Firefox ${RegExp.$1.split('.')[0]}`;
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  // Phone / device model name
  let device_name = '';
  const android = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build|\)|;)/i);
  if (android && android[1]) device_name = android[1].trim();
  else if (/iPhone/i.test(ua)) device_name = 'iPhone';
  else if (/iPad/i.test(ua)) device_name = 'iPad';
  else if (/Windows/i.test(ua)) device_name = 'Windows PC';
  else if (/Macintosh/i.test(ua)) device_name = 'Mac';
  else device_name = device_type === 'mobile' ? 'Mobile device' : 'Computer';

  const is_pwa =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

  return { device_name, device_type, os, browser, is_pwa: !!is_pwa, user_agent: ua };
}

/* ---------------- Geo lookup (country / state / city) ---------------- */
type Geo = { ip?: string; country?: string; country_code?: string; region?: string; city?: string; timezone?: string };
const GEO_KEY = 'ar_geo_cache_v1';

async function getGeo(): Promise<Geo> {
  try {
    const cached = localStorage.getItem(GEO_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.t < 24 * 60 * 60 * 1000) return parsed.geo as Geo;
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const j = await res.json();
      const geo: Geo = {
        ip: j.ip,
        country: j.country_name,
        country_code: j.country_code,
        region: j.region,
        city: j.city,
        timezone: j.timezone,
      };
      try { localStorage.setItem(GEO_KEY, JSON.stringify({ t: Date.now(), geo })); } catch { /* ignore */ }
      return geo;
    }
  } catch { /* ignore */ }

  return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

/* ---------------- Log a visit ---------------- */
let lastLogged = 0;

export async function logVisit(userId?: string | null, username?: string | null): Promise<void> {
  // avoid double-logging within the same 5 minutes of one open tab
  if (Date.now() - lastLogged < 5 * 60 * 1000) return;
  lastLogged = Date.now();

  const geo = await getGeo();
  const device = detectDevice();

  try {
    await db.from('visitor_sessions').insert({
      user_id: userId ?? null,
      username: username ?? null,
      path: window.location.pathname,
      ...geo,
      ...device,
    });
  } catch { /* table missing / offline — ignore silently */ }
}

/* ---------------- Admin queries ---------------- */
export async function getVisitorSessions(limit = 500): Promise<VisitorSession[]> {
  const { data, error } = await db
    .from('visitor_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []) as VisitorSession[];
}

export async function getVisitorCount(): Promise<number> {
  const { count } = await db.from('visitor_sessions').select('id', { count: 'exact', head: true });
  return count || 0;
}

export async function getSignupDates(): Promise<Record<string, string>> {
  const { data } = await db.from('profiles').select('user_id, username, created_at');
  const map: Record<string, string> = {};
  (data || []).forEach((p: any) => {
    if (p.user_id) map[p.user_id] = p.created_at;
  });
  return map;
}

export async function getRegisteredVisitors(): Promise<RegisteredVisitor[]> {
  const { data, error } = await db
    .from('profiles')
    .select('user_id, username, full_name, avatar_url, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return [];
  const profiles = (data || []) as RegisteredVisitor[];

  // Admin-only: enrich with email + last sign-in time. Silently skipped if
  // the caller isn't an admin or the function isn't deployed yet — the page
  // still works, just without those two columns.
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-list-user-emails', { body: {} });
    if (!fnError && fnData?.users) {
      const byId = new Map<string, { email: string | null; last_sign_in_at: string | null; updated_at: string | null }>(
        fnData.users.map((u: { user_id: string; email: string | null; last_sign_in_at: string | null; updated_at: string | null }) => [u.user_id, u]),
      );
      return profiles.map(p => ({ ...p, ...(byId.get(p.user_id) || {}) }));
    }
  } catch { /* function not available — ignore */ }
  return profiles;
}
