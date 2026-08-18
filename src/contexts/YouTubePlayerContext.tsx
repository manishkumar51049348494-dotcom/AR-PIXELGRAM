import React, { createContext, useContext, useMemo, useState } from "react";
import YouTubeWatch from "@/components/youtube/YouTubeWatch";
import type { YouTubeItem, YouTubeKind } from "@/services/youtube";

interface PlayerState {
  item: YouTubeItem;
  kind: YouTubeKind;
}

interface YouTubePlayerContextValue {
  play: (item: YouTubeItem, kind: YouTubeKind) => void;
  current: PlayerState | null;
}

const YouTubePlayerContext = createContext<
  YouTubePlayerContextValue | undefined
>(undefined);

export const YouTubePlayerProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [current, setCurrent] = useState<PlayerState | null>(null);
  const value = useMemo(
    () => ({
      current,
      play: (item: YouTubeItem, kind: YouTubeKind) =>
        setCurrent({ item, kind }),
    }),
    [current],
  );

  return (
    <YouTubePlayerContext.Provider value={value}>
      {children}
      {current ? (
        <YouTubeWatch
          item={current.item}
          kind={current.kind}
          onSelect={(item) => setCurrent({ item, kind: current.kind })}
          onClose={() => setCurrent(null)}
        />
      ) : null}
    </YouTubePlayerContext.Provider>
  );
};

export function useYouTubePlayer(): YouTubePlayerContextValue {
  const value = useContext(YouTubePlayerContext);
  if (!value)
    throw new Error(
      "useYouTubePlayer must be used inside YouTubePlayerProvider",
    );
  return value;
}
