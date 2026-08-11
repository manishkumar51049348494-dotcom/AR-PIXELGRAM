import React, { useState, useEffect } from 'react';
import MobileLayout from '@/components/layouts/MobileLayout';
import { searchProfiles } from '@/services/api';
import type { Profile } from '@/types/types';
import { Input } from '@/components/ui/input';
import { Search, BadgeCheck, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    setLoading(true);
    searchProfiles(debouncedQuery).then(profiles => {
      setResults(profiles);
      setLoading(false);
    });
  }, [debouncedQuery]);

  return (
    <MobileLayout>
      <div className="p-4 page-transition">
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search people…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-11 pl-9"
            autoFocus
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
        </div>

        {!query.trim() ? (
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
