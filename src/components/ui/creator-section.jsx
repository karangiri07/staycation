import { useMemo } from 'react';
import { cld } from '../../lib/cloudinary.js';
import { INSTAGRAM_REELS_URL } from '../../lib/creator.js';
import './creator-section.css';

const Out = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
);

const GRADIENT = (
  <defs>
    <linearGradient id="cs-ig" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stopColor="#f58529" />
      <stop offset="0.5" stopColor="#dd2a7b" />
      <stop offset="1" stopColor="#8134af" />
    </linearGradient>
  </defs>
);

const ICON = {
  youtube: (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <rect x="2" y="6" width="24" height="16.5" rx="5" fill="#ff1f3d" />
      <path d="M11.6 10.6v7.2l6.4-3.6z" fill="#fff" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 28 28" fill="none" stroke="url(#cs-ig)" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      {GRADIENT}
      <rect x="3.5" y="3.5" width="21" height="21" rx="6.5" />
      <circle cx="14" cy="14" r="5" />
      <circle cx="20.2" cy="7.8" r="1.2" fill="url(#cs-ig)" stroke="none" />
    </svg>
  ),
  views: (
    <svg viewBox="0 0 28 28" fill="none" stroke="url(#cs-ig)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GRADIENT}
      <circle cx="14" cy="14" r="10.5" />
      <path d="M11.6 9.9v8.2l6.7-4.1z" fill="url(#cs-ig)" />
    </svg>
  ),
};

// Pine-tree skyline. Positions come from a fixed seed so the picture never changes between renders.
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pine(x, base, h, w) {
  const y = base - h;
  const p = (dx, dy) => `${(x + dx * w).toFixed(1)} ${(y + dy * h).toFixed(1)}`;
  return `M${p(0, 0)}L${p(0.26, 0.3)}L${p(0.13, 0.3)}L${p(0.4, 0.62)}L${p(0.2, 0.62)}L${p(0.5, 0.96)}L${p(0.07, 0.96)}L${p(0.07, 1)}L${p(-0.07, 1)}L${p(-0.07, 0.96)}L${p(-0.5, 0.96)}L${p(-0.2, 0.62)}L${p(-0.4, 0.62)}L${p(-0.13, 0.3)}L${p(-0.26, 0.3)}Z`;
}
function skyline(seed, count, base, minH, maxH, edgeBias) {
  const random = seeded(seed);
  let d = '';
  for (let i = 0; i < count; i += 1) {
    // most trees frame the left and right edges; a few stand in the middle so narrow phone screens still show a skyline
    const side = random() < 0.5 ? 0 : 1;
    const spread = Math.pow(random(), edgeBias) * 520;
    const x = random() < 0.3 ? random() * 1440 : side ? 1440 - spread : spread;
    const h = minH + random() * (maxH - minH);
    d += pine(x, base, h, h * 0.46);
  }
  return d;
}

function Hills() {
  const back = useMemo(() => skyline(11, 46, 150, 34, 74, 1.5), []);
  const front = useMemo(() => skyline(29, 34, 172, 44, 96, 1.9), []);
  return (
    <svg className="cs-hills" viewBox="0 0 1440 180" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 118C110 78 190 104 290 72S470 58 560 90 760 62 860 82 1100 50 1200 86 1360 72 1440 96V180H0Z" fill="#f5dcc3" />
      <path d="M0 142C140 108 260 128 380 102S620 96 720 122 960 102 1080 120 1330 102 1440 128V180H0Z" fill="#ebc7a6" />
      <path d={back} fill="#8a8d9e" opacity="0.55" />
      <path d="M0 158C200 146 420 164 720 154S1200 146 1440 158V180H0Z" fill="#1e2842" />
      <path d={front} fill="#263150" />
      <rect x="0" y="170" width="1440" height="10" fill="#1a2236" />
    </svg>
  );
}

export default function CreatorSection({ creator }) {
  const photo = cld(creator.photo, 480);
  const stats = [
    creator.stat_youtube
      ? { key: 'youtube', icon: ICON.youtube, value: creator.stat_youtube, label: 'YouTube Subscribers', href: creator.youtube_url }
      : { key: 'youtube', icon: ICON.youtube, value: 'Watch', label: 'on YouTube', href: creator.youtube_url },
    creator.stat_instagram && { key: 'instagram', icon: ICON.instagram, value: creator.stat_instagram, label: 'Instagram Followers', href: creator.instagram_url },
    creator.stat_views && { key: 'views', icon: ICON.views, value: creator.stat_views, label: 'Reel Views', href: INSTAGRAM_REELS_URL },
  ].filter(Boolean);

  return (
    <section id="creator" className="cs">
      <div className="wrap">
        <div className="cs-card">
          <div className="cs-photo">
            <svg className="cs-spark" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M6 20 17 24M12 8 19 17M26 4 26 15" stroke="#f08a2c" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            </svg>
            <img src={photo} alt={`${creator.name}, the creator of Staycation`} width="176" height="176" />
          </div>

          <div className="cs-copy">
            <p className="cs-kicker">MEET THE CREATOR</p>
            <h2>{creator.headline}</h2>
            <p className="cs-bio">{creator.bio}</p>
          </div>

          <ul className="cs-stats">
            {stats.map((stat) => (
              <li key={stat.key}>
                <a href={stat.href} target="_blank" rel="noreferrer">
                  <span className="cs-stat-icon">{stat.icon}</span>
                  <b>{stat.value}</b>
                  <span className="cs-stat-label">{stat.label}</span>
                </a>
              </li>
            ))}
          </ul>

          <a className="cs-cta" href={creator.instagram_url} target="_blank" rel="noreferrer">
            Follow My Journey <Out />
          </a>
        </div>
      </div>
      <Hills />
    </section>
  );
}
