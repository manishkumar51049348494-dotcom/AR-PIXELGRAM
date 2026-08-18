import React, { useState, useEffect } from 'react';
import MobileLayout from '@/components/layouts/MobileLayout';
import { searchProfiles } from '@/services/api';
import type { Profile } from '@/types/types';
import { Input } from '@/components/ui/input';
import { Search, BadgeCheck, Loader2, Users, Music2, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import YouTubeResults from '@/components/youtube/YouTubeResults';

type SearchTab = 'people' | 'audio' | 'video';

const TABS: { key: SearchTab; label: string; icon: React.ElementType }[] = [
  { key: 'people', label: 'लोग', icon: Users },
  { key: 'audio', label: 'गाने', icon: Music2 },
  { key: 'video', label: 'वीडियो', icon: Video },
];

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>('people');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (tab !== 'people') return;
    if (!debouncedQuery.trim()) { setResults([]); return; }
    setLoading(true);
    searchProfiles(debouncedQuery).then(profiles => {
      setResults(profiles);
      setLoading(false);
    });
  }, [debouncedQuery, tab]);

  const placeholder =
    tab === 'people' ? 'Search people…' : tab === 'audio' ? 'गाने का नाम खोजें…' : 'वीडियो खोजें…';

  return (
    <MobileLayout>
      <div className="p-4 page-transition">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-11 pl-9"
            autoFocus
          />
          {loading && tab === 'people' && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
        </div>

        {/* लोग / गाने / वीडियो tabs — search box के नीचे */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border',
                  active
                    ? 'text-white border-transparent'
                    : 'text-muted-foreground border-border/60 hover:bg-muted',
                )}
                style={active ? { background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {tab !== 'people' ? (
          <YouTubeResults query={debouncedQuery} kind={tab} />
        ) : !query.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-16 h-16 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Search for people by username or name</p>
          </div>
        ) : results.length === 0 && !loading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No users found for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className="space-y-1">
            {results.map(profile => (
              <Link
                key={profile.id}
                to={`/user/${profile.user_id}`}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-lg">{profile.username[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-sm text-foreground truncate">{profile.username}</span>
                    {profile.is_verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                  {profile.full_name && <p className="text-xs text-muted-foreground truncate">{profile.full_name}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default SearchPage;
