import React from 'react';
import { X, Music2 } from 'lucide-react';
import type { YouTubeItem, YouTubeKind } from '@/services/youtube';

interface YouTubePlayerProps {
  item: YouTubeItem;
  kind: YouTubeKind;
  onClose: () => void;
}

/**
 * नीचे fixed player — official YouTube embed चलाता है.
 * audio mode में compact music-player जैसा card दिखता है,
 * video mode में पूरा 16:9 player.
 */
const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ item, kind, onClose }) => {
  const src = `https://www.youtube.com/embed/${item.id}?autoplay=1&playsinline=1&rel=0`;

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-[60] safe-bottom">
      <div className="mx-2 mb-[68px] rounded-2xl overflow-hidden glass-card border border-border/60 shadow-xl">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white"
            style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}>
            <Music2 className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{item.channel}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close player"
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {kind === 'video' ? (
          <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
            <iframe
              key={item.id}
              src={src}
              title={item.title}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3">
            <img
              src={item.thumbnail}
              alt={item.title}
              loading="lazy"
              className="w-14 h-14 rounded-xl object-cover shrink-0"
            />
            <div className="flex-1 min-w-0 overflow-hidden rounded-lg" style={{ height: 60 }}>
              <iframe
                key={item.id}
                src={src}
                title={item.title}
                className="w-full"
                style={{ height: 60, border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default YouTubePlayer;
