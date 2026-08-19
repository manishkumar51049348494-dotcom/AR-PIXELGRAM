import React, { useRef, useState } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
  /** Jis element ka scroll dekhna hai — default: window scroll */
  scrollRef?: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  className?: string;
}

const THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Instagram jaisa pull-to-refresh.
 * Page top par ho aur user neeche kheenche to spinner aata hai, chhodne par
 * onRefresh chalta hai.
 */
const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, scrollRef, disabled, className }) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  const atTop = () => {
    const el = scrollRef?.current;
    if (el) return el.scrollTop <= 0;
    return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    startY.current = atTop() ? e.touches[0].clientY : null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) { setPull(0); return; }
    if (!atTop()) { startY.current = null; setPull(0); return; }
    setPull(Math.min(MAX_PULL, delta * 0.5));
  };

  const finish = async () => {
    if (startY.current === null) return;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } catch {
        /* ignore */
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const active = pull > 0 || refreshing;

  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={finish}
      onTouchCancel={finish}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: active ? pull : 0,
          transition: startY.current === null ? 'height 0.2s ease' : undefined,
        }}
      >
        {refreshing ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className="w-6 h-6 text-primary transition-transform"
            style={{ transform: `rotate(${pull >= THRESHOLD ? 180 : 0}deg)`, opacity: Math.min(1, pull / THRESHOLD) }}
          />
        )}
      </div>
      {children}
    </div>
  );
};

export default PullToRefresh;
