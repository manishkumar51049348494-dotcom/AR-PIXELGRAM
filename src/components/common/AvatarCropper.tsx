import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn } from 'lucide-react';

interface Props {
  file: File;
  onCancel: () => void;
  onDone: (file: File, previewUrl: string) => void;
}

const BOX = 260;   // on-screen crop circle size
const OUT = 512;   // exported image size

/**
 * Facebook jaisa profile photo adjuster — photo ko drag karke set karo,
 * zoom slider se chhota/bada karo, phir crop hoke square JPEG banta hai.
 */
const AvatarCropper: React.FC<Props> = ({ file, onCancel, onDone }) => {
  const [src, setSrc] = useState<string>('');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // base scale = "cover" the crop box
  const baseScale = img ? Math.max(BOX / img.width, BOX / img.height) : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback((next: { x: number; y: number }) => {
    if (!img) return next;
    const maxX = Math.max(0, (img.width * scale - BOX) / 2);
    const maxY = Math.max(0, (img.height * scale - BOX) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, [img, scale]);

  useEffect(() => { setOffset(o => clamp(o)); }, [clamp]);

  const start = (x: number, y: number) => { dragRef.current = { x, y, ox: offset.x, oy: offset.y }; };
  const move = (x: number, y: number) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + (x - d.x), y: d.oy + (y - d.y) }));
  };
  const end = () => { dragRef.current = null; };

  const handleDone = async () => {
    if (!img) return;
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas_unavailable');
      const ratio = OUT / BOX;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, OUT, OUT);
      const drawW = img.width * scale * ratio;
      const drawH = img.height * scale * ratio;
      ctx.drawImage(
        img,
        OUT / 2 - drawW / 2 + offset.x * ratio,
        OUT / 2 - drawH / 2 + offset.y * ratio,
        drawW,
        drawH,
      );
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('crop_failed'))), 'image/jpeg', 0.9),
      );
      const cropped = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      onDone(cropped, canvas.toDataURL('image/jpeg', 0.9));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="relative mx-auto overflow-hidden rounded-full bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
        style={{ width: BOX, height: BOX }}
        onMouseDown={e => start(e.clientX, e.clientY)}
        onMouseMove={e => move(e.clientX, e.clientY)}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={e => start(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={e => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={end}
      >
        {src && img && (
          <img
            src={src}
            alt="Selected"
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none"
            style={{
              width: img.width * scale,
              height: img.height * scale,
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        )}
      </div>

      <div className="flex items-center gap-3 px-1">
        <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
        <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={v => setZoom(v[0])} />
      </div>
      <p className="text-center text-xs text-muted-foreground">Photo ko drag karke set karein</p>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1 h-11" onClick={onCancel}>Cancel</Button>
        <Button type="button" className="flex-1 h-11 font-semibold" onClick={handleDone} disabled={!img || saving}>
          {saving ? 'Saving…' : 'Save photo'}
        </Button>
      </div>
    </div>
  );
};

export default AvatarCropper;
