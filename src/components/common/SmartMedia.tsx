import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { isLegacyMediaUrl, retryMediaOnError } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';

interface SmartImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  /** Grid thumbnails me chhota message chahiye */
  compact?: boolean;
}

function Unavailable({ compact }: { compact?: boolean }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground px-2 text-center">
      <ImageOff className={compact ? 'w-4 h-4' : 'w-7 h-7'} />
      {!compact && (
        <span className="text-[11px] leading-tight">
          Yeh media purane server par tha, ab available nahi
        </span>
      )}
    </div>
  );
}

/**
 * Photo dikhane ka safe tareeka: pehle asli URL, fail hone par signed URL,
 * aur agar media sach me gayab hai to safed box ki jagah saaf message.
 */
export function SmartImage({ src, alt = '', className, compact }: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed || isLegacyMediaUrl(src)) return <Unavailable compact={compact} />;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn('w-full h-full object-cover', className)}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.mediaRetried === '1') {
          setFailed(true);
          return;
        }
        retryMediaOnError(el, src);
      }}
    />
  );
}

export { Unavailable as MediaUnavailable };
