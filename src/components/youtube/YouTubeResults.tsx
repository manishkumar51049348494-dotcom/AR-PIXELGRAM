import React, { useEffect, useState } from 'react';
import { Loader2, Flame } from 'lucide-react';
import {
  searchYouTube,
  getTrending,
  formatYouTubeDuration,
  formatViews,
  type YouTubeItem,
  type YouTubeKind,
} from '@/services/youtube';

interface YouTubeResultsProps {
  /** search box में जो लिखा है (debounced) — खाली हो तो trending दिखता है */
  query: string;
  kind: YouTubeKind;
  onSelect: (item: YouTubeItem) => void;
}

/** YouTube जैसा feed — search खाली हो तो trending गाने/वीडियो पहले से दिखते हैं. */
const YouTubeResults: React.FC<YouTubeResultsProps> = ({ query, kind, onSelect }) => {
  const [items, setItems] = useState<YouTubeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTrending, setIsTrending] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    const q = query.trim();
    setLoading(true);
    setIsTrending(!q);
    const p = q ? searchYouTube(q, kind, ac.signal) : getTrending(kind, ac.signal);
    p.then((res) => {
      if (!ac.signal.aborted) setItems(res);
    }).finally(() => {
      if (!ac.signal.aborted) setLoading(false);
    });
    return () => ac.abort();
  }, [query, kind]);

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">
          {query.trim() ? 'खोज रहे हैं…' : 'ट्रेंडिंग लोड हो रही है…'}
        </span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-sm">
          {query.trim() ? `“${query}” के लिए कुछ नहीं मिला` : 'कुछ लोड नहीं हुआ — दोबारा कोशिश करें'}
        </p>
      </div>
    );
  }

  return (
    <>
      {isTrending && (
        <p className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground">
          <Flame className="w-3.5 h-3.5 text-primary" />
          {kind === 'audio' ? 'ट्रेंडिंग गाने' : 'ट्रेंडिंग वीडियो'}
        </p>
      )}

      <div className={kind === 'video' ? 'space-y-3' : 'space-y-1'}>
        {items.map((item) =>
          kind === 'video' ? (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full text-left rounded-xl overflow-hidden hover:bg-muted transition-colors"
            >
              <div className="relative w-full bg-muted" style={{ aspectRatio: '16 / 9' }}>
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {item.durationSec > 0 && (
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-semibold">
                    {formatYouTubeDuration(item.durationSec)}
                  </span>
                )}
              </div>
              <div className="px-1 py-2">
                <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.channel}
                  {item.views ? ` · ${formatViews(item.views)}` : ''}
                </p>
              </div>
            </button>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left hover:bg-muted transition-colors"
            >
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.channel}
                  {item.durationSec > 0 ? ` · ${formatYouTubeDuration(item.durationSec)}` : ''}
                </p>
              </div>
            </button>
          ),
        )}
      </div>
    </>
  );
};

export default YouTubeResults;
