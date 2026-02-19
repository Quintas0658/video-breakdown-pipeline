"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  onTimeUpdate?: (time: number) => void;
  onReady?: (player: YT.Player) => void;
}

export default function YouTubePlayer({
  videoId,
  onTimeUpdate,
  onReady,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<number | null>(null);

  const startTimeSync = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      if (playerRef.current && onTimeUpdate) {
        try {
          const time = playerRef.current.getCurrentTime();
          onTimeUpdate(time);
        } catch {
          // player not ready yet
        }
      }
    }, 250);
  }, [onTimeUpdate]);

  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current) return;

      // Destroy old player if exists
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          cc_load_policy: 0,
        },
        events: {
          onReady: (event: YT.PlayerEvent) => {
            startTimeSync();
            onReady?.(event.target);
          },
        },
      });
    };

    // Load YouTube IFrame API if not loaded
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, onReady, startTimeSync]);

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// Expose a way to seek from outside
export function seekTo(player: YT.Player | null, time: number) {
  player?.seekTo(time, true);
}
