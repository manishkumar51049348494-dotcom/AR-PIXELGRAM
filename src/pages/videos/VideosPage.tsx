import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { Input } from '@/components/ui/input';
import { Search, Mic, Loader2, Plus, Lock, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getVideosFeed,
  searchVideos,
  formatVideoViews,
  formatDuration,
  timeAgoHi,
  type AppVideo,
} from '@/services/videos';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

/** वीडियो — apne users ke upload kiye gaye video (gaana, comedy, film) search + play. */
const VideosPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const [videos, setVideos] = useState<AppVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const rows = q.trim() ? await searchVideos(q) : await getVideosFeed(40, 0);
      setVideos(rows);
    } catch (e) {
      console.error('videos load failed', e);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(debounced);
  }, [debounced, load]);

  // Voice search — Hindi + English dono samajhta hai
  const startVoice = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error('Is browser me voice search support nahi hai');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = 'hi-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setQuery(text);
    };
    rec.onerror = () => {
      setListening(false);
      toast.error('Awaz samajh nahi aayi — dobara try karein');
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <MobileLayout>
      <div className="p-4 page-transition">
        {/* Search + voice + upload */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="गाना, film, comedy — कुछ भी खोजें…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9 pr-11"
            />
            <button
              type="button"
              onClick={startVoice}
              aria-label="Voice search"
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                listening ? 'bg-destructive text-destructive-foreground animate-pulse' : 'hover:bg-muted'
              }`}
            >
              <Mic className={`w-4 h-4 ${listening ? 'text-white' : 'text-muted-foreground'}`} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate('/upload-video')}
            aria-label="Add video"
            title="Add video"
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">लोड हो रहा है…</span>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">
              {query.trim() ? `“${query}” के लिए कोई video नहीं मिला` : 'अभी कोई video upload नहीं हुआ'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => navigate(`/videos/${v.id}`)}
                className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.99] transition-transform"
              >
                <div className="relative w-full bg-muted rounded-2xl overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
                  {v.thumbnail_url ? (
                    <img
                      src={v.thumbnail_url}
                      alt={v.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={v.video_url}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )}
                  {formatDuration(v.duration_sec) && (
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-semibold">
                      {formatDuration(v.duration_sec)}
                    </span>
                  )}
                  {v.visibility === 'private' && (
                    <span className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold">
                      <Lock className="w-3 h-3" /> Private
                    </span>
                  )}
                </div>
                <div className="flex gap-3 px-1 py-2">
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={v.profile?.avatar_url || undefined} />
                    <AvatarFallback>{(v.profile?.username || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground line-clamp-2">{v.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {v.profile?.username || 'user'}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="w-3 h-3" />
                      {formatVideoViews(v.views_count)} views · {timeAgoHi(v.created_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default VideosPage;
