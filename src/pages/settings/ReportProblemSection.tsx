import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, ChevronRight, Bug, ShieldAlert, UserX, Image as ImageIcon,
  MessageSquareWarning, Lock, CircleDollarSign, Ban, Copyright, HelpCircle,
  ImagePlus, Video, X, Send,
} from 'lucide-react';
import { submitProblemReport, uploadImage, uploadVideo } from '@/services/api';

interface Category {
  value: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: Category[] = [
  { value: 'bug', title: 'Something isn\'t working', desc: 'App crash, error ya koi feature kaam nahi kar raha', icon: Bug },
  { value: 'post', title: 'Inappropriate post', desc: 'Nudity, violence ya offensive content', icon: ImageIcon },
  { value: 'story', title: 'Inappropriate story', desc: 'Story me galat ya offensive content', icon: ImageIcon },
  { value: 'user', title: 'Suspicious or fake account', desc: 'Fake profile, impersonation ya spam account', icon: UserX },
  { value: 'harassment', title: 'Bullying or harassment', desc: 'Koi aapko ya kisi ko pareshan kar raha hai', icon: MessageSquareWarning },
  { value: 'hate', title: 'Hate speech or symbols', desc: 'Nafrat failane wala content', icon: Ban },
  { value: 'scam', title: 'Scam or fraud', desc: 'Paise, gift ya fake offer ka dhokha', icon: CircleDollarSign },
  { value: 'spam', title: 'Spam', desc: 'Baar baar wahi message, fake links', icon: ShieldAlert },
  { value: 'privacy', title: 'Privacy concern', desc: 'Meri photo, info ya data ka misuse', icon: Lock },
  { value: 'copyright', title: 'Intellectual property', desc: 'Mera content bina permission use hua', icon: Copyright },
  { value: 'other', title: 'Something else', desc: 'Koi aur problem ya feedback', icon: HelpCircle },
];

const MAX_IMAGES = 3;

interface Props {
  userId: string;
  onBack: () => void;
  onDone: () => void;
}

const ReportProblemSection: React.FC<Props> = ({ userId, onBack, onDone }) => {
  const [selected, setSelected] = useState<Category | null>(null);
  const [desc, setDesc] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const pickImages = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (picked.length === 0) return;
    setImages(prev => {
      const next = [...prev, ...picked].slice(0, MAX_IMAGES);
      if (prev.length + picked.length > MAX_IMAGES) toast.info(`Max ${MAX_IMAGES} screenshot add kar sakte hain`);
      return next;
    });
  };

  const pickVideo = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('Video file select karein'); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error('Video 50MB se chhoti honi chahiye'); return; }
    setVideo(file);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    if (!desc.trim()) { toast.error('Problem ka thoda description likhein'); return; }
    setLoading(true);
    try {
      const attachments: string[] = [];
      for (const img of images) {
        attachments.push(await uploadImage('posts', img, userId));
      }
      if (video) {
        attachments.push(await uploadVideo('stories', video, userId));
      }
      const details = [
        `[${selected.title}]`,
        desc.trim(),
        attachments.length ? `\nAttachments:\n${attachments.join('\n')}` : '',
      ].filter(Boolean).join('\n');

      await submitProblemReport(userId, selected.value, details);
      toast.success('Report bhej di gayi. Hamari team review karegi 🙏');
      setSelected(null);
      setDesc('');
      setImages([]);
      setVideo(null);
      onDone();
    } catch (err) {
      toast.error((err as Error).message || 'Report submit nahi ho paayi');
    } finally {
      setLoading(false);
    }
  };

  // Step 1 — category list (Facebook style)
  if (!selected) {
    return (
      <div className="p-4 page-transition">
        <button onClick={onBack} className="flex items-center gap-2 mb-5 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <h2 className="text-xl font-bold text-foreground">Report a Problem</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-5 text-pretty">
          Kya problem hai? Neeche se ek option chunein. Aap screenshot ya video bhi bhej sakte hain.
        </p>
        <div className="space-y-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelected(cat)}
              className="w-full flex items-center gap-3 px-4 py-3.5 glass-card rounded-xl hover:bg-muted/60 transition-colors text-left"
            >
              <cat.icon className="w-5 h-5 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{cat.title}</p>
                <p className="text-xs text-muted-foreground text-pretty">{cat.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2 — details + attachments
  return (
    <div className="p-4 page-transition">
      <button onClick={() => setSelected(null)} className="flex items-center gap-2 mb-5 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <selected.icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground truncate">{selected.title}</h2>
          <p className="text-xs text-muted-foreground truncate">{selected.desc}</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label>Problem detail me batayein</Label>
          <Textarea
            placeholder="Kya hua, kab hua, kis screen par hua…"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={6}
            maxLength={1000}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{desc.length}/1000</p>
        </div>

        <div className="space-y-2">
          <Label>Screenshot / Photo (optional)</Label>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={`${img.name}-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 bg-background/90 rounded-full p-0.5"
                  aria-label="Remove screenshot"
                >
                  <X className="w-3.5 h-3.5 text-foreground" />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => imageInput.current?.click()}
                className="w-20 h-20 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-[10px]">Add</span>
              </button>
            )}
          </div>
          <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={e => { pickImages(e.target.files); e.currentTarget.value = ''; }} />
        </div>

        <div className="space-y-2">
          <Label>Video (optional)</Label>
          {video ? (
            <div className="flex items-center gap-3 glass-card rounded-xl px-4 py-3">
              <Video className="w-5 h-5 text-primary shrink-0" />
              <p className="flex-1 min-w-0 text-sm text-foreground truncate">{video.name}</p>
              <button onClick={() => setVideo(null)} aria-label="Remove video">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => videoInput.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-3.5 glass-card rounded-xl hover:bg-muted/60 transition-colors"
            >
              <Video className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm text-foreground">Video select karein (max 50MB)</span>
            </button>
          )}
          <input ref={videoInput} type="file" accept="video/*" hidden onChange={e => { pickVideo(e.target.files); e.currentTarget.value = ''; }} />
        </div>

        <Button className="w-full h-11 font-semibold" onClick={handleSubmit} disabled={loading || !desc.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {loading ? 'Bhej rahe hain…' : 'Submit Report'}
        </Button>
        <p className="text-xs text-muted-foreground text-center text-pretty">
          Report seedha hamari team ke paas jaati hai. Zaroorat padne par hum aapse contact karenge.
        </p>
      </div>
    </div>
  );
};

export default ReportProblemSection;
