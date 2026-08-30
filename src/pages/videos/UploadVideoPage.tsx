import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, Loader2, Lock, Globe, ImagePlus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createVideo, uploadVideoFile, uploadVideoThumbnail } from '@/services/videos';

/**
 * YouTube jaisa upload flow —
 *  1) Gallery se video select  →  Continue
 *  2) Title, description, thumbnail (video ke frame se ya apni photo), private/public
 *  3) Upload progress ke saath publish
 */
const UploadVideoPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const [thumbBlob, setThumbBlob] = useState<Blob | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [thumbTime, setThumbTime] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { if (thumbPreview) URL.revokeObjectURL(thumbPreview); }, [thumbPreview]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast.error('Video file select karein');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  /** Video ke current frame se thumbnail banao (customise — slider se frame chuno). */
  const captureThumb = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth || 1280;
      canvas.height = v.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) {
        toast.error('Thumbnail nahi ban paayi — apni photo choose karein');
        return;
      }
      if (thumbPreview) URL.revokeObjectURL(thumbPreview);
      setThumbBlob(blob);
      setThumbPreview(URL.createObjectURL(blob));
      toast.success('Thumbnail set ho gayi');
    } catch {
      toast.error('Thumbnail nahi ban paayi — apni photo choose karein');
    }
  };

  const handleCustomThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('Photo select karein');
      return;
    }
    if (thumbPreview) URL.revokeObjectURL(thumbPreview);
    setThumbBlob(f);
    setThumbPreview(URL.createObjectURL(f));
  };

  const handlePublish = async () => {
    if (!user) { toast.error('Pehle login karein'); return; }
    if (!file) { toast.error('Video select karein'); return; }
    if (!title.trim()) { toast.error('Title likhein'); return; }

    setUploading(true);
    setProgress(0);
    try {
      const videoUrl = await uploadVideoFile(file, user.id, setProgress);
      let thumbnailUrl: string | null = null;
      if (thumbBlob) {
        try {
          thumbnailUrl = await uploadVideoThumbnail(thumbBlob, user.id);
        } catch {
          thumbnailUrl = null;
        }
      }
      const created = await createVideo({
        userId: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        videoUrl,
        thumbnailUrl,
        durationSec: duration ? Math.round(duration) : null,
        visibility,
      });
      toast.success('Video upload ho gaya!');
      navigate(`/videos/${created.id}`, { replace: true });
    } catch (e) {
      console.error('video upload failed', e);
      toast.error(e instanceof Error ? e.message : 'Upload fail hua — dobara try karein');
    } finally {
      setUploading(false);
    }
  };

  /* ------------------------------- STEP 1 -------------------------------- */
  if (step === 'pick') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <div className="flex items-center gap-2 px-3 py-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <p className="text-white font-bold">Add Video Create</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          {preview ? (
            <video
              src={preview}
              className="w-full max-h-[55vh] rounded-2xl bg-black"
              controls
              playsInline
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video rounded-2xl border-2 border-dashed border-white/25 flex flex-col items-center justify-center gap-3"
            >
              <Film className="w-10 h-10 text-white/70" />
              <p className="text-lg font-bold text-white">Gallery से video चुनें</p>
              <p className="text-xs text-white/60">गाना, comedy, film — कितना भी बड़ा video</p>
            </button>
          )}

          {preview && (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-white/70 underline">
              दूसरा video चुनें
            </button>
          )}
        </div>

        <div className="px-5 pb-8">
          <Button
            className="w-full h-12 rounded-xl font-bold"
            disabled={!file}
            onClick={() => setStep('details')}
          >
            Continue
          </Button>
        </div>

        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handlePick} />
      </div>
    );
  }

  /* ------------------------------- STEP 2 -------------------------------- */
  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border/50">
        <button onClick={() => setStep('pick')} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <p className="font-bold text-foreground">Video details</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Thumbnail customise */}
        <div>
          <p className="text-sm font-bold text-foreground mb-2">Thumbnail</p>
          <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '16 / 9' }}>
            {thumbPreview ? (
              <img src={thumbPreview} alt="thumbnail" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <video
                ref={videoRef}
                src={preview || undefined}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                muted
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              />
            )}
          </div>

          {!thumbPreview && (
            <div className="mt-3 space-y-2">
              <input
                type="range"
                min={0}
                max={Math.max(duration || 0, 0.1)}
                step={0.1}
                value={thumbTime}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  setThumbTime(t);
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                Slider से frame चुनें, फिर “इस frame को thumbnail बनाएं” दबाएं
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            {!thumbPreview ? (
              <Button variant="secondary" className="flex-1 rounded-xl" onClick={captureThumb}>
                <Check className="w-4 h-4 mr-1" /> इस frame को thumbnail बनाएं
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="flex-1 rounded-xl"
                onClick={() => {
                  if (thumbPreview) URL.revokeObjectURL(thumbPreview);
                  setThumbPreview(null);
                  setThumbBlob(null);
                }}
              >
                हटाएं
              </Button>
            )}
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => thumbInputRef.current?.click()}>
              <ImagePlus className="w-4 h-4 mr-1" /> Gallery से photo
            </Button>
          </div>
        </div>

        {/* Title / description */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">Title</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video ka title" className="h-11" maxLength={140} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">Description</p>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Video ke baare me likhein…"
            className="min-h-24"
            maxLength={5000}
          />
        </div>

        {/* Visibility */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">कौन देख सकता है</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left ${
                visibility === 'public' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <Globe className="w-4 h-4 text-foreground" />
              <span>
                <span className="block text-sm font-bold text-foreground">Public</span>
                <span className="block text-[11px] text-muted-foreground">सभी users देख सकते हैं</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left ${
                visibility === 'private' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <Lock className="w-4 h-4 text-foreground" />
              <span>
                <span className="block text-sm font-bold text-foreground">Private</span>
                <span className="block text-[11px] text-muted-foreground">सिर्फ़ आप देख सकते हैं</span>
              </span>
            </button>
          </div>
        </div>

        {uploading && (
          <div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{progress}% upload हुआ — app बंद न करें</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-6 pt-2 border-t border-border/50">
        <Button className="w-full h-12 rounded-xl font-bold" disabled={uploading} onClick={handlePublish}>
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Upload हो रहा है…
            </>
          ) : (
            'Video Upload करें'
          )}
        </Button>
      </div>

      <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomThumb} />
    </div>
  );
};

export default UploadVideoPage;
