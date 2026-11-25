'use client';

/**
 * Landing → ভিডিও টিউটোরিয়াল. Links come from the admin settings (GET /config, tutorialVideos).
 * Each card shows only the YouTube cover image until tapped (light page); then the privacy-friendly
 * youtube-nocookie player loads in place. Hidden when no links are set or the server can't be reached.
 */
import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Video {
  title: string;
  url: string;
}

/** youtube.com/shorts/ID, youtu.be/ID, youtube.com/watch?v=ID -> ID */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:shorts\/|youtu\.be\/|[?&]v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function VideoCard({ v, n }: { v: Video; n: number }) {
  const id = youtubeId(v.url);
  const [play, setPlay] = useState(false);
  if (!id) return null;
  return (
    <figure className="overflow-hidden rounded-3xl bg-white shadow-card">
      <div className="relative aspect-[9/16] w-full bg-ink">
        {play ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={v.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button type="button" onClick={() => setPlay(true)} aria-label={`${v.title} চালান`} className="group absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/10">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-on-primary shadow-hero transition-transform group-hover:scale-110">
                <Play className="ml-1 h-8 w-8" fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="px-4 py-3 text-base font-bold text-ink">
        {['১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'][n] ?? n + 1}. {v.title}
      </figcaption>
    </figure>
  );
}

export function LandingVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  useEffect(() => {
    let alive = true;
    apiFetch<{ tutorialVideos?: Video[] }>('/config')
      .then((c) => alive && setVideos((c.tutorialVideos ?? []).filter((v) => youtubeId(v.url))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (videos.length === 0) return null;
  return (
    <section id="videos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
      <h2 className="text-2xl font-extrabold md:text-3xl">ভিডিও দেখে শিখুন</h2>
      <p className="mt-2 text-base text-ink-muted">এক মিনিটের ছোট ভিডিও। বাংলায়, সহজ করে।</p>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {videos.map((v, i) => (
          <VideoCard key={v.url} v={v} n={i} />
        ))}
      </div>
    </section>
  );
}
