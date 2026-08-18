import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  X,
  ThumbsUp,
  MessageCircle,
  Download,
  Eye,
  Loader2,
  Music2,
  Play,
} from 'lucide-react';
import {
  getVideoDetails,
  getComments,
  formatYouTubeDuration,
  formatCount,
  formatViews,
  startDownload,
  type YouTubeDetails,
  type YouTubeComment,
  type YouTubeItem,
  type YouTubeKind,
} from '@/services/youtube';
import { cn } from '@/lib/utils';

interface YouTubeWatchProps {
  item: YouTubeItem;
  kind: YouTubeKind;
  /** नया वीडियो चुना गया (related list से) */
  onSelect: (item: YouTubeItem) => void;
  onClose: () => void;
}

/**
 * YouTube जैसा watch screen —
 * ऊपर player (seek / pause / fullscreen सब YouTube के controls),
 * नीचे title, views, likes, description, comments और related गाने scroll करके.
 * ऊपर के arrow से player छोटा (mini) हो जाता है, tap करने पर फिर बड़ा.
 */
const YouTubeWatch: React.FC<YouTubeWatchProps> = ({ item, kind, onSelect, onClose }) => {
  const [mini, setMini] = useState(false);
  const [details, setDetails] = useState<YouTubeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [descOpen, setDescOpen] = useState(false);
  const [tab, setTab] = useState<'related' | 'comments'>('related');
  const [comments, setComments] = useState<YouTubeComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);

  const src = useMemo(
    () =>
      `https://www.youtube.com/embed/${item.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3`,
    [item.id],
  );

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setDetails(null);
    setComments(null);
    setDescOpen(false);
    setTab('related');
    setDlOpen(false);
    getVideoDetails(item, kind, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setDetails(d);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [item, kind]);

  useEffect(() => {
    if (tab !== 'comments' || comments) return;
    const ac = new AbortController();
    setCommentsLoading(true);
    getComments(item.id, ac.signal)
      .then((c) => {
        if (!ac.signal.aborted) setComments(c);
      })
      .finally(() => {
        if (!ac.signal.aborted) setCommentsLoading(false);
      });
    return () => ac.abort();
  }, [tab, comments, item.id]);

  const downloads = [...(details?.audioDownloads || []), ...(details?.videoDownloads || [])];

  /* ------------------------------ MINI PLAYER ------------------------------ */
  if (mini) {
    return (
      <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-lg z-[70] px-2">
        <div className="flex items-center gap-2 rounded-2xl overflow-hidden bg-card border border-border shadow-xl">
          <div className="relative w-[110px] shrink-0 bg-black" style={{ aspectRatio: '16 / 9' }}>
            <iframe
              src={src}
              title={item.title}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <button type="button" onClick={() => setMini(false)} className="flex-1 min-w-0 text-left py-2">
            <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{item.channel}</p>
          </button>
          <button
            onClick={onClose}
            aria-label="बंद करें"
            className="w-9 h-9 mr-1 rounded-full flex items-center justify-center hover:bg-muted shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------ FULL PLAYER ----------------------------- */
  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col">
      {/* top bar */}
      <div className="flex items-center gap-1 px-1 py-1 border-b border-border/60 shrink-0">
        <button
          onClick={() => setMini(true)}
          aria-label="छोटा करें"
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted"
        >
          <ChevronDown className="w-5 h-5 text-foreground" />
        </button>
        <p className="flex-1 min-w-0 text-xs font-semibold text-muted-foreground truncate">
          {kind === 'audio' ? 'गाना चल रहा है' : 'वीडियो चल रहा है'}
        </p>
        <button
          onClick={onClose}
          aria-label="बंद करें"
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* player — seek, pause, fullscreen सब YouTube के controls से */}
      <div className="relative w-full bg-black shrink-0" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          src={src}
          title={item.title}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {/* scrollable info + related */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-24">
        <div className="p-3">
          <h1 className="text-sm font-bold text-foreground leading-snug">{details?.title || item.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            {(details?.views ?? item.views) ? (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {formatViews(details?.views ?? item.views)}
              </span>
            ) : null}
            {details?.likes ? (
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" />
                {formatCount(details.likes)}
              </span>
            ) : null}
            {details?.uploaded ? <span>{String(details.uploaded).slice(0, 10)}</span> : null}
          </div>

          {/* channel + download */}
          <div className="flex items-center gap-2 mt-3">
            {details?.channelAvatar ? (
              <img src={details.channelAvatar} alt={details.channel} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Music2 className="w-4 h-4 text-primary" />
              </div>
            )}
            <p className="flex-1 min-w-0 text-xs font-semibold text-foreground truncate">
              {details?.channel || item.channel}
            </p>
            <button
              type="button"
              onClick={() => setDlOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
            >
              <Download className="w-3.5 h-3.5" />
              डाउनलोड
            </button>
          </div>

          {/* download options */}
          {dlOpen && (
            <div className="mt-2 rounded-xl border border-border/60 divide-y divide-border/50 overflow-hidden">
              {loading ? (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> लिंक तैयार हो रहे हैं…
                </div>
              ) : downloads.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  इस वीडियो के लिए download लिंक नहीं मिला — थोड़ी देर बाद दोबारा कोशिश करें.
                </p>
              ) : (
                downloads.map((d, i) => (
                  <button
                    key={`${d.url}-${i}`}
                    type="button"
                    onClick={() => startDownload(d, details?.title || item.title)}
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted"
                  >
                    <Download className="w-4 h-4 text-primary shrink-0" />
                    <span className="flex-1 text-xs font-medium text-foreground">
                      {d.kind === 'audio' ? 'MP3 / Audio' : 'Video'} · {d.label}
                    </span>
                    {d.sizeMb ? <span className="text-[10px] text-muted-foreground">{d.sizeMb} MB</span> : null}
                  </button>
                ))
              )}
            </div>
          )}

          {/* description */}
          {details?.description ? (
            <button
              type="button"
              onClick={() => setDescOpen((v) => !v)}
              className="w-full text-left mt-3 p-3 rounded-xl bg-muted/50"
            >
              <p className="text-[11px] font-semibold text-foreground mb-1">Description</p>
              <p className={cn('text-[11px] text-muted-foreground whitespace-pre-line', !descOpen && 'line-clamp-3')}>
                {details.description}
              </p>
              <span className="text-[10px] text-primary font-semibold">
                {descOpen ? 'कम दिखाओ' : 'और पढ़ें'}
              </span>
            </button>
          ) : null}
        </div>

        {/* tabs: related / comments */}
        <div className="flex items-center gap-2 px-3 pb-2 border-b border-border/50">
          {([
            { key: 'related' as const, label: kind === 'audio' ? 'और गाने' : 'और वीडियो', icon: Play },
            { key: 'comments' as const, label: 'Comments', icon: MessageCircle },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                tab === key ? 'text-white border-transparent' : 'text-muted-foreground border-border/60',
              )}
              style={tab === key ? { background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' } : {}}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'related' ? (
          <div className="p-2 space-y-1">
            {loading && !details ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-4 h-4 animate-spin" /> लोड हो रहा है…
              </div>
            ) : (details?.related.length || 0) === 0 ? (
              <p className="text-center py-10 text-xs text-muted-foreground">कुछ नहीं मिला</p>
            ) : (
              details!.related.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-muted transition-colors"
                >
                  <div className="relative w-[110px] shrink-0 rounded-lg overflow-hidden bg-muted" style={{ aspectRatio: '16 / 9' }}>
                    <img src={r.thumbnail} alt={r.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    {r.durationSec > 0 && (
                      <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-white text-[9px] font-semibold">
                        {formatYouTubeDuration(r.durationSec)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground line-clamp-2">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.channel}</p>
                    {r.views ? <p className="text-[10px] text-muted-foreground">{formatViews(r.views)}</p> : null}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {commentsLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-4 h-4 animate-spin" /> comments आ रहे हैं…
              </div>
            ) : (comments?.length || 0) === 0 ? (
              <p className="text-center py-10 text-xs text-muted-foreground">Comments उपलब्ध नहीं</p>
            ) : (
              comments!.map((c) => (
                <div key={c.id} className="flex gap-2">
                  {c.avatar ? (
                    <img src={c.avatar} alt={c.author} loading="lazy" className="w-7 h-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">{c.author[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">
                      {c.author} {c.time ? `· ${c.time}` : ''}
                    </p>
                    <p className="text-xs text-foreground whitespace-pre-line break-words">{c.text}</p>
                    {c.likes ? (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <ThumbsUp className="w-3 h-3" /> {formatCount(c.likes)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default YouTubeWatch;
