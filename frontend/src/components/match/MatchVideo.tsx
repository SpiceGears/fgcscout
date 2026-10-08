"use client";

import { useEffect, useRef, useState } from "react";

type Player = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  destroy: () => void;
};
type PlayerApi = {
  Player: new (iframe: HTMLIFrameElement, options: {
    events: { onReady: (event: { target: Player }) => void; onStateChange: (event: { target: Player; data: number }) => void };
  }) => Player;
};
type VideoWindow = Window & { YT?: PlayerApi; onYouTubeIframeAPIReady?: () => void };
let apiLoading: Promise<PlayerApi> | undefined;

function loadPlayerApi(): Promise<PlayerApi> {
  const browser = window as VideoWindow;
  if (browser.YT?.Player) return Promise.resolve(browser.YT);
  if (apiLoading) return apiLoading;
  apiLoading = new Promise((resolve, reject) => {
    const previous = browser.onYouTubeIframeAPIReady;
    browser.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (browser.YT?.Player) resolve(browser.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => { apiLoading = undefined; script.remove(); reject(new Error("Player API unavailable")); };
    document.head.appendChild(script);
  });
  return apiLoading;
}

export default function MatchVideo({ src, title }: { src: string; title: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const container = mount.current;
    if (!container) return;
    let disposed = false;
    let player: Player | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;
    let positioned = false;
    const embed = new URL(src);
    const start = Number(embed.searchParams.get("start") ?? 0);
    embed.searchParams.set("enablejsapi", "1");
    embed.searchParams.set("origin", window.location.origin);
    const iframe = document.createElement("iframe");
    iframe.src = embed.toString();
    iframe.title = title;
    iframe.className = "aspect-video w-full";
    iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;
    container.appendChild(iframe);

    // Some live players ignore the URL start until playback initializes.
    // Retry only during initial positioning; later manual seeking stays unrestricted.
    function position(target: Player) {
      if (disposed || positioned || start <= 0) return;
      const current = target.getCurrentTime();
      if (Math.abs(current - start) <= 6) {
        positioned = true;
        clearInterval(timer);
        return;
      }
      if (++attempts > 15) {
        positioned = true;
        clearInterval(timer);
        setNotice("YouTube did not seek to the match. Use Jump to match or the timeline.");
        return;
      }
      target.seekTo(start, true);
    }
    void loadPlayerApi().then((api) => {
      if (disposed) return;
      player = new api.Player(iframe, { events: {
        onReady: ({ target }) => {
          playerRef.current = target;
          position(target);
        },
        onStateChange: ({ target, data }) => {
          if (data !== 1 || start <= 0 || positioned || timer) return;
          position(target);
          if (!positioned) timer = setInterval(() => position(target), 1000);
        },
      } });
    }).catch(() => {
      if (!disposed) setNotice("Automatic seeking is unavailable. Use the YouTube timeline.");
    });
    return () => {
      disposed = true;
      clearInterval(timer);
      playerRef.current = null;
      player?.destroy();
      container.replaceChildren();
    };
  }, [src, title]);

  const start = Number(new URL(src).searchParams.get("start") ?? 0);
  return <div>
    <div ref={mount} />
    {start > 0 && <button type="button" className="px-3 py-2 text-sm text-sky-400 hover:underline" onClick={() => {
      playerRef.current?.seekTo(start, true);
    }}>Jump to match · {Math.floor(start / 3600)}:{String(Math.floor(start / 60) % 60).padStart(2, "0")}:{String(start % 60).padStart(2, "0")}</button>}
    {notice && <p className="px-3 pb-3 text-sm text-gray-400">{notice}</p>}
  </div>;
}
