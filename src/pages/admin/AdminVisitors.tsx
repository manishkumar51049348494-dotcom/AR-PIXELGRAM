import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { getVisitorSessions, getRegisteredVisitors, type RegisteredVisitor, type VisitorSession } from '@/services/visitorTracking';
import { Globe2, Smartphone, Users, Loader2, MapPin, Search, RefreshCw, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      })
    : '—';

const AdminVisitors: React.FC = () => {
  const [rows, setRows] = useState<VisitorSession[]>([]);
  const [registered, setRegistered] = useState<RegisteredVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getVisitorSessions(500), getRegisteredVisitors()]).then(([v, users]) => {
      setRows(v);
      setRegistered(users);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(r =>
      [r.username, r.country, r.region, r.city, r.device_name, r.os, r.browser, r.ip]
        .some(v => (v || '').toLowerCase().includes(t))
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    const countries = new Set(rows.map(r => r.country).filter(Boolean));
    const devices = new Set(rows.map(r => r.device_name).filter(Boolean));
    const users = new Set(rows.map(r => r.user_id).filter(Boolean));
    const today = new Date().toDateString();
    const todayVisits = rows.filter(r => new Date(r.created_at).toDateString() === today).length;
    return { total: rows.length, countries: countries.size, devices: devices.size, users: registered.length, todayVisits };
  }, [rows, registered.length]);

  const perUser = useMemo(() => {
    const map = new Map<string, { id: string; name: string; fullName?: string | null; avatar?: string | null; visits: number; last?: string; country: string; device: string; joined?: string; email?: string | null; lastLogin?: string | null; passwordChanged?: string | null }>();
    registered.forEach(profile => {
      map.set(profile.user_id, {
        id: profile.user_id,
        name: profile.username,
        fullName: profile.full_name,
        avatar: profile.avatar_url,
        visits: 0,
        country: 'No visit captured yet',
        device: 'No device captured yet',
        joined: profile.created_at,
        email: profile.email,
        lastLogin: profile.last_sign_in_at,
        passwordChanged: profile.updated_at,
      });
    });
    rows.forEach(r => {
      const key = r.user_id || `guest:${r.ip || 'unknown'}`;
      const cur = map.get(key);
      if (cur) {
        cur.visits += 1;
        if (!cur.last || r.created_at > cur.last) cur.last = r.created_at;
        cur.country = [r.city, r.region, r.country].filter(Boolean).join(', ') || cur.country;
        cur.device = [r.device_name, r.os].filter(Boolean).join(' · ') || cur.device;
      } else {
        map.set(key, {
          id: key,
          name: r.username || (r.user_id ? 'User' : 'Guest'),
          visits: 1,
          last: r.created_at,
          country: [r.city, r.region, r.country].filter(Boolean).join(', ') || '—',
          device: [r.device_name, r.os].filter(Boolean).join(' · ') || '—',
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
  }, [rows, registered]);

  const cards = [
    { label: 'Total Visits', value: stats.total, icon: Globe2 },
    { label: 'Visits Today', value: stats.todayVisits, icon: CalendarClock },
    { label: 'Countries', value: stats.countries, icon: MapPin },
    { label: 'Devices', value: stats.devices, icon: Smartphone },
    { label: 'Registered Users', value: stats.users, icon: Users },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">Visitors & Devices</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Country, state, device name, visit count and exact date/time of every visit
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 shadow-card">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase font-semibold">
                <Icon className="w-3.5 h-3.5 text-primary" /> {label}
              </div>
              <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
            </div>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by user, country, state, device…"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Per user / per device summary */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <h3 className="font-semibold text-foreground mb-4">Visit Count per User / Device</h3>
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      {['User', 'Email', 'Visits', 'Location', 'Device', 'Account Created', 'Last Visit', 'Last Login', 'Password/Account Updated'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perUser.map(u => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-muted/40">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold shrink-0">
                                {u.name[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">@{u.name}</p>
                              {u.fullName && <p className="text-xs text-muted-foreground">{u.fullName}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{u.email || '—'}</td>
                        <td className="px-3 py-2.5 text-sm font-bold text-primary">{u.visits}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{u.country}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{u.device}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.joined ? fmt(u.joined) : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(u.last)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.lastLogin ? fmt(u.lastLogin) : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.passwordChanged ? fmt(u.passwordChanged) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {rows.length === 0 && (
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <p className="text-sm text-muted-foreground">Registered accounts upar dikh rahe hain. Location/device tracking table activate hote hi visit details automatic fill hongi.</p>
              </div>
            )}

            {/* Full visit log */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <h3 className="font-semibold text-foreground mb-4">All Visits ({filtered.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border">
                      {['Date & Time', 'User', 'Country', 'State', 'City', 'Device Name', 'Type', 'OS', 'Browser', 'App', 'Page', 'IP'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(r.created_at)}</td>
                        <td className="px-3 py-2.5 text-sm font-medium text-foreground">{r.username || (r.user_id ? 'User' : 'Guest')}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{r.country || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{r.region || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{r.city || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-foreground">{r.device_name || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">{r.device_type || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.os || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.browser || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.is_pwa ? 'Installed app' : 'Browser'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.path || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.ip || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminVisitors;
