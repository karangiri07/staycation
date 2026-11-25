import { useEffect, useState } from 'react';

// Shown until the admin saves their own values (Admin → Creator & footer). Anything left empty there falls back to these.
export const CREATOR_DEFAULTS = {
  name: 'Arunn',
  headline: 'The Staycation Explorer',
  bio: "I'm Arunn (@vlogsbyarunn), a content creator exploring unique stays, hidden getaways and travel experiences across Maharashtra.",
  photo: '/creator-avatar.jpg',
  instagram_url: 'https://www.instagram.com/vlogsbyarunn/',
  youtube_url: 'https://www.youtube.com/@Arunngoswamii',
  email: 'staycation.collab@gmail.com',
  stat_instagram: '5K+',
  stat_youtube: '',
  stat_views: '2M+',
};

export const INSTAGRAM_REELS_URL = 'https://www.instagram.com/vlogsbyarunn/reels/';

// "https://www.youtube.com/@Arunngoswamii" -> "@Arunngoswamii"
export function handleOf(url, fallback = '') {
  const match = String(url || '').match(/(?:instagram\.com|youtube\.com)\/(@?[\w.]+)/i);
  if (!match) return fallback;
  return match[1].startsWith('@') ? match[1] : `@${match[1]}`;
}

export function useCreator(api = '') {
  const [saved, setSaved] = useState({});
  useEffect(() => {
    let alive = true;
    fetch(`${api}/api/public/creator`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => { if (alive && data && typeof data === 'object' && !Array.isArray(data)) setSaved(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [api]);
  return { ...CREATOR_DEFAULTS, ...saved };
}
