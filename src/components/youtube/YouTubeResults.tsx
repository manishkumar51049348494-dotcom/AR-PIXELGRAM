import React, { useEffect, useState } from 'react';
import { Loader2, Music2, PlayCircle, Video } from 'lucide-react';
import {
  searchYouTube,
  formatYouTubeDuration,
  formatViews,
  type YouTubeItem,
  type YouTubeKind,
} from '@/services/youtube';
import YouTubePlayer from './YouTubePlayer';

interface YouTubeResultsProps {
  /** ऊपर के search box में जो लिखा है (debounced) */
  query: string;
  kind: YouTubeKind;
}

/** YouTube जैसे search results — गाने (audio) और वीडियो, tap करके play. */
const YouTubeResults: React.FC<YouTubeResultsProps> = ({ query, kind }) => {
  const [items, setItems] = useState<YouTubeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState<YouTubeItem | null>(null);

  useEffect(() => {
    setPlaying(null);
    if (!query.trim()) {
      setItems([]);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    searchYouTube(query, kind, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setItems(res);
        setFailed(res.length === 0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, kind]);

  if (!query.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        {kind === 'audio' ? (
          <Music2 className="w-14 h-14 text-muted-foreground mb-3" />
        ) : (
          <Video className="w-14 h-14 text-muted-foreground mb-3" />
        )}
        <p className="text-muted-foreground text-sm">
          {kind === 'audio'
            ? 'गाने का नाम लिखकर खोजें'
            : 'वीडियो का नाम लिखकर खोजें'}
        </p>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">खोज रहे हैं…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-sm">
          {failed
            ? `“${query}” के लिए कुछ नहीं मिला — दोबारा कोशिश करें`
            : 'कोई result नहीं'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={kind === 'video' ? 'space-y-3' : 'space-y-1'}>
        {items.map((item) =>
          kind === 'video' ? (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlaying(item)}
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
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {formatYouTubeDuration(item.durationSec)}
                  </span>
                )}
                <PlayCircle className="absolute inset-0 m-auto w-11 h-11 text-white/90 drop-shadow" />
              </div>
              <div className="px-1 py-2">
                <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.channel}
                  {formatViews(item.views) ? ` · ${formatViews(item.views)}` : ''}
                </p>
              </div>
            </button>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlaying(item)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left hover:bg-muted transition-colors"
            >
              <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-muted">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <PlayCircle className="absolute inset-0 m-auto w-6 h-6 text-white/90 drop-shadow" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.channel}</p>
              </div>
              {item.durationSec > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatYouTubeDuration(item.durationSec)}
                </span>
              )}
            </button>
          ),
        )}
      </div>

      {playing && (
        <YouTubePlayer item={playing} kind={kind} onClose={() => setPlaying(null)} />
      )}
    </>
  );
};

export default YouTubeResults;
