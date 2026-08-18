import React, { useState } from 'react';
import MobileLayout from '@/components/layouts/MobileLayout';
import { Input } from '@/components/ui/input';
import { Search, Music2, Video } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import YouTubeResults from '@/components/youtube/YouTubeResults';
import YouTubeWatch from '@/components/youtube/YouTubeWatch';
import type { YouTubeItem, YouTubeKind } from '@/services/youtube';

const TABS: { key: YouTubeKind; label: string; icon: React.ElementType }[] = [
  { key: 'audio', label: 'गाने (MP3)', icon: Music2 },
  { key: 'video', label: 'वीडियो', icon: Video },
];

/** खोजें — YouTube जैसा गाने / वीडियो search, play, download. */
const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<YouTubeKind>('audio');
  const [playing, setPlaying] = useState<YouTubeItem | null>(null);
  const debouncedQuery = useDebounce(query, 400);

  return (
    <MobileLayout>
      <div className="p-4 page-transition">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={kind === 'audio' ? 'गाने का नाम खोजें…' : 'वीडियो खोजें…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>

        {/* गाने / वीडियो — search box के नीचे */}
        <div className="flex items-center gap-2 mb-4">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = kind === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setKind(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border',
                  active ? 'text-white border-transparent' : 'text-muted-foreground border-border/60 hover:bg-muted',
                )}
                style={active ? { background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        <YouTubeResults query={debouncedQuery} kind={kind} onSelect={setPlaying} />
      </div>

      {playing && (
        <YouTubeWatch
          item={playing}
          kind={kind}
          onSelect={setPlaying}
          onClose={() => setPlaying(null)}
        />
      )}
    </MobileLayout>
  );
};

export default SearchPage;
