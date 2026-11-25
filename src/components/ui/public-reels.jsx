import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { properties } from '../../data.js';
import { INSTAGRAM_REELS_URL, handleOf, useCreator } from '../../lib/creator.js';
import './public-reels.css';

const API = import.meta.env.VITE_API_URL || '';
const HANDLE = '@vlogsbyarunn';
const demoReels = [
  { id: 'demo-1', title: 'A villa escape in Maharashtra', video_url: 'https://www.instagram.com/reel/DfMM3-6s5Kl/', poster: properties[1].image },
  { id: 'demo-2', title: 'A weekend made for unwinding', video_url: 'https://www.instagram.com/reel/De30XeTNPe3/', poster: properties[2].image },
];

const isInstagram = (reel) => /instagram\.com\//i.test(reel.video_url || '');
const cleanTitle = (title) =>
  (title || '').replace(/\.(mp4|mov|webm)$/i, '').replace(/_+/g, ' ').trim() || 'Staycation reel';
const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

/* Small inline icons (no extra dependency) */
const I = {
  play: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2Z" /></svg>,
  playCircle: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="currentColor" /><path d="M9.7 7.5v9a.7.7 0 0 0 1.07.6l7.1-4.5a.7.7 0 0 0 0-1.2l-7.1-4.5a.7.7 0 0 0-1.07.6Z" fill="#fff" /></svg>,
  pause: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.2" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" /></svg>,
  camera: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h8A2.5 2.5 0 0 1 16 7.5v1.2l4.2-2.4a.8.8 0 0 1 1.2.7v10a.8.8 0 0 1-1.2.7L16 15.3v1.2a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5v-9Z" /></svg>,
  film: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1.5 2v2H8V6H5.5Zm0 4v4H8v-4H5.5Zm0 6v2H8v-2H5.5ZM16 6v2h2.5V6H16Zm0 4v4h2.5v-4H16Zm0 6v2h2.5v-2H16Z" /></svg>,
  heart: <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 20.4S4.1 15.7 2.7 10.6C1.8 7.3 3.9 4.5 7 4.5c1.9 0 3.5 1 5 3 1.5-2 3.1-3 5-3 3.1 0 5.2 2.8 4.3 6.1-1.4 5.1-9.3 9.8-9.3 9.8Z" /></svg>,
  mute: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9.5v5h3.6l4.4 3.6V5.9L7.6 9.5H4Z" /><path d="m15.2 9.4 5 5m0-5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>,
  sound: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9.5v5h3.6l4.4 3.6V5.9L7.6 9.5H4Z" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6m2.6-8.6a8 8 0 0 1 0 11.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>,
  left: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>,
  right: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>,
};

// Tells the server a reel was watched. Once per reel per browser tab here; the server also limits repeats per visitor.
function countView(id) {
  if (typeof id !== 'number') return;
  try {
    const seen = JSON.parse(sessionStorage.getItem('staycation_reel_views') || '[]');
    if (seen.includes(id)) return;
    sessionStorage.setItem('staycation_reel_views', JSON.stringify([...seen, id].slice(-200)));
  } catch { /* storage blocked: the server limit still applies */ }
  fetch(`${API}/api/reels/${id}/view`, { method: 'POST', keepalive: true }).catch(() => {});
}

// The heart is a personal "save" for this browser only (nothing is sent to the server).
const LIKES_KEY = 'staycation_reel_likes';
function readLikes() {
  try {
    const list = JSON.parse(localStorage.getItem(LIKES_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function writeLikes(list) {
  try { localStorage.setItem(LIKES_KEY, JSON.stringify(list.slice(-300))); } catch { /* storage blocked: the heart still works until reload */ }
}

// Where a reel stands when it is not playing (the same first frame the card shows when the page loads).
const START = 0.1;

function ReelCard({ reel, index, reducedMotion, isDemo, isPlaying, auto, userPause, onToggle, onEnded, onBlocked, photo, handle, liked, onLike }) {
  const counted = useRef(false);
  const videoRef = useRef(null);
  const linkOnly = isDemo || isInstagram(reel);
  const poster = reel.poster || properties[(index + 1) % properties.length].image;
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);
  const [photoOk, setPhotoOk] = useState(true);
  const title = cleanTitle(reel.title);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      // A reel that starts by itself always starts silent (browsers refuse sound without a tap).
      if (auto && !muted) setMuted(true);
      video.muted = auto ? true : muted;
      // A reel that starts by itself always starts from the beginning.
      if (auto) video.currentTime = START;
      const attempt = video.play();
      if (attempt && attempt.catch) {
        attempt.catch((error) => {
          if (error.name !== 'AbortError') onBlocked();
        });
      }
    } else {
      video.pause();
      // Scrolled away (or another reel took over): go back to the start. Only a pause the viewer
      // pressed themselves keeps its place, so they can carry on from there.
      if (!userPause) video.currentTime = START;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const chipLabel = isDemo ? 'Demo reel' : `Reel ${String(index + 1).padStart(2, '0')}`;
  const time = formatTime(duration);

  const media = (
    <>
      {linkOnly ? (
        <img src={poster} alt="" loading="lazy" />
      ) : (
        <video
          ref={videoRef}
          src={`${reel.video_url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          aria-label={title}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onEnded={() => { if (isPlaying) onEnded(reel.id); }}
          onTimeUpdate={(event) => { if (!counted.current && event.currentTarget.currentTime >= 1) { counted.current = true; countView(reel.id); } }}
        />
      )}
      <span className="reel-chip reel-chip-left">
        <span className="reel-chip-icon">{I.film}</span>
        {chipLabel}
      </span>
      {!linkOnly && time && <span className="reel-chip reel-chip-right">{time}</span>}
      <span className="reel-play" aria-hidden={!linkOnly}>
        {linkOnly ? I.play : isPlaying ? I.pause : I.play}
      </span>
    </>
  );

  return (
    <motion.article
      className={`reel-card${isPlaying ? ' is-playing' : ''}${liked ? ' is-liked' : ''}`}
      initial={reducedMotion ? false : { opacity: 0, y: 28 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.55, delay: reducedMotion ? 0 : Math.min(index, 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      {linkOnly ? (
        <a
          className="reel-media"
          href={reel.video_url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Watch ${title} on Instagram`}
        >
          {media}
        </a>
      ) : (
        <button
          type="button"
          className="reel-media"
          onClick={() => onToggle(reel.id)}
          aria-label={`${isPlaying ? 'Pause' : 'Play'} ${title}`}
        >
          {media}
        </button>
      )}
      {!linkOnly && isPlaying && (
        <button
          type="button"
          className="reel-mute"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        >
          {muted ? I.mute : I.sound}
        </button>
      )}
      <div className="reel-info">
        <h3>{title}</h3>
        <p className="reel-by">
          {photo && photoOk ? (
            <img src={photo} alt="" loading="lazy" onError={() => setPhotoOk(false)} />
          ) : (
            <span className="reel-by-fallback" aria-hidden="true">{handle.replace('@', '').charAt(0).toUpperCase()}</span>
          )}
          <span>{handle}</span>
        </p>
      </div>
      <button
        type="button"
        className="reel-like"
        onClick={() => onLike(reel.id)}
        aria-pressed={liked}
        aria-label={`${liked ? 'Remove from saved' : 'Save'} ${title}`}
      >
        {I.heart}
      </button>
    </motion.article>
  );
}

export default function PublicReels() {
  const creator = useCreator(API);
  const [reels, setReels] = useState([]);
  const [error, setError] = useState('');
  const reducedMotion = useReducedMotion();
  const [likes, setLikes] = useState(readLikes);

  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [edge, setEdge] = useState({ start: true, end: false });
  const [inView, setInView] = useState(false);
  // Which cards are mostly on screen inside the carousel, and whether this browser tab is in front.
  const [visible, setVisible] = useState([]);
  const [tabOn, setTabOn] = useState(true);
  // null = automatic (plays the active card), 'paused' = viewer paused, otherwise the id the viewer chose
  const [manual, setManual] = useState(null);
  // The reels play one after another: autoIndex is the one the sequence is on, hold is true while the
  // carousel slides to the next one, finished means every reel has played once (back on the first, stopped).
  const [autoIndex, setAutoIndex] = useState(null);
  const [hold, setHold] = useState(false);
  const [finished, setFinished] = useState(false);
  const finishedRef = useRef(false);
  const quiet = useRef(0);
  const settle = useRef(0);
  finishedRef.current = finished;

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/reels`)
      .then((response) => {
        if (!response.ok) throw new Error('Published reels are temporarily unavailable.');
        return response.json();
      })
      .then((list) => {
        if (alive && Array.isArray(list)) setReels(list);
      })
      .catch((requestError) => {
        if (alive) setError(requestError.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  const isDemo = reels.length === 0;
  const items = isDemo ? demoReels : reels;

  const stepOf = () => {
    const track = trackRef.current;
    const cards = track ? track.children : [];
    if (cards.length > 1) return cards[1].offsetLeft - cards[0].offsetLeft;
    return track ? track.clientWidth : 0;
  };

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const count = track.children.length;
    const overflow = track.scrollWidth > track.clientWidth + 4;
    const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    const step = stepOf() || 1;
    const index = !overflow ? 0 : atEnd ? count - 1 : Math.round(track.scrollLeft / step);
    setCanScroll(overflow);
    setActive(Math.max(0, Math.min(count - 1, index)));
    setEdge({ start: track.scrollLeft <= 4, end: atEnd });
    const box = track.getBoundingClientRect();
    const seen = [];
    Array.prototype.forEach.call(track.children, (card, position) => {
      const rect = card.getBoundingClientRect();
      const shown = Math.min(rect.right, box.right) - Math.max(rect.left, box.left);
      if (rect.width > 0 && shown / rect.width >= 0.55) seen.push(position);
    });
    setVisible((previous) => (previous.length === seen.length && previous.every((value, at) => value === seen[at]) ? previous : seen));
  }, []);

  // When the viewer moves the carousel, the reel in front (not the old sequence position) plays once it settles.
  const reanchor = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => setAutoIndex(null), 160);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const onUserScroll = () => {
      if (Date.now() <= quiet.current) return; // the carousel is sliding by itself
      if (finishedRef.current) setFinished(false);
      reanchor();
    };
    const onTouch = () => { quiet.current = 0; };
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('scroll', onUserScroll, { passive: true });
    track.addEventListener('pointerdown', onTouch, { passive: true });
    track.addEventListener('touchstart', onTouch, { passive: true });
    track.addEventListener('wheel', onTouch, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null;
    observer?.observe(track);
    window.addEventListener('resize', onScroll);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('scroll', onUserScroll);
      track.removeEventListener('pointerdown', onTouch);
      track.removeEventListener('touchstart', onTouch);
      track.removeEventListener('wheel', onTouch);
      clearTimeout(settle.current);
      observer?.disconnect();
      window.removeEventListener('resize', onScroll);
    };
  }, [measure, items.length]);

  // Playback follows the cards, not the whole section: once they scroll off the screen the video stops.
  useEffect(() => {
    const node = trackRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setTabOn(!document.hidden);
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // Leaving the cards ends whatever the viewer picked, so coming back plays the card in front again.
  useEffect(() => {
    if (!inView) {
      setManual(null);
      setFinished(false);
      setHold(false);
      setAutoIndex(null);
    }
  }, [inView]);
  // Swiping to another card ends a pause, so the next reel starts by itself.
  useEffect(() => {
    setManual((current) => (current === 'paused' ? null : current));
  }, [active]);
  // A reel the viewer started keeps playing while it is on screen, and stops once it has scrolled away.
  useEffect(() => {
    if (!manual || manual === 'paused' || visible.length === 0) return;
    const position = items.findIndex((item) => item.id === manual);
    if (position < 0 || !visible.includes(position)) setManual(null);
  }, [visible, manual, items]);

  // The sequence stays on its reel while that reel is on screen (or the carousel is sliding to it);
  // if the viewer swipes it away, the reel in front takes over.
  const front = autoIndex !== null && (hold || visible.length === 0 || visible.includes(autoIndex)) ? autoIndex : active;
  useEffect(() => {
    if (hold && autoIndex !== null && visible.includes(autoIndex)) setHold(false);
  }, [hold, visible, autoIndex]);
  useEffect(() => {
    if (!hold) return undefined;
    const timer = setTimeout(() => setHold(false), 1600);
    return () => clearTimeout(timer);
  }, [hold]);

  const frontItem = items[front];
  const autoId = !reducedMotion && !finished && frontItem && !isDemo && !isInstagram(frontItem) ? frontItem.id : null;
  const playingId = !inView || !tabOn ? null : manual === 'paused' ? null : manual ?? autoId;

  const toggle = (id) => {
    // A card that is only peeking in at the edge slides into place first, then plays.
    const position = items.findIndex((item) => item.id === id);
    if (visible.length > 0 && !visible.includes(position)) {
      goTo(position);
      return;
    }
    setFinished(false);
    setManual(playingId === id ? 'paused' : id);
  };
  // A reel reached its end: the next one starts. After the last one the carousel goes back to the first reel and stops.
  const advance = (id) => {
    const position = items.findIndex((item) => item.id === id);
    if (position < 0) return;
    clearTimeout(settle.current);
    setManual(null);
    const next = position + 1;
    if (reducedMotion || next >= items.length) {
      setFinished(true);
      setHold(false);
      setAutoIndex(0);
      if (!reducedMotion) slideTo(0);
      return;
    }
    setAutoIndex(next);
    if (!visible.includes(next)) {
      setHold(true);
      slideTo(next);
    }
  };
  const toggleLike = (id) => {
    setLikes((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      writeLikes(next);
      return next;
    });
  };
  const slideTo = (index) => {
    quiet.current = Date.now() + 1600;
    trackRef.current?.scrollTo({ left: index * stepOf(), behavior: 'smooth' });
  };
  const goTo = (index) => {
    setFinished(false);
    quiet.current = 0;
    reanchor();
    trackRef.current?.scrollTo({ left: index * stepOf(), behavior: 'smooth' });
  };
  const nudge = (direction) => {
    setFinished(false);
    quiet.current = 0;
    reanchor();
    trackRef.current?.scrollBy({ left: direction * stepOf(), behavior: 'smooth' });
  };

  const showDots = canScroll && items.length > 1;
  const handle = handleOf(creator.instagram_url, HANDLE);
  const allReelsUrl = /instagram\.com\//i.test(creator.instagram_url || '')
    ? `${creator.instagram_url.replace(/\/+$/, '')}/reels/`
    : INSTAGRAM_REELS_URL;

  return (
    <section className="reels-section" id="reels" ref={sectionRef}>
      <div className="wrap">
        <div className="reels-head">
          <div className="reels-head-text">
            <span className="reels-kicker">
              <span className="reels-kicker-icon">{I.playCircle}</span>
              STAYS IN MOTION
            </span>
            <h2>
              Take a little <em>getaway,</em> right here.
            </h2>
            <p>Get a closer look at the places you could be waking up in.</p>
          </div>
          <div className="reels-controls">
            {canScroll && (
              <div className="reel-arrows">
                <button type="button" className="reel-arrow" onClick={() => nudge(-1)} disabled={edge.start} aria-label="Previous reels">
                  {I.left}
                </button>
                <button type="button" className="reel-arrow" onClick={() => nudge(1)} disabled={edge.end} aria-label="Next reels">
                  {I.right}
                </button>
              </div>
            )}
            <a className="reels-all" href={allReelsUrl} target="_blank" rel="noreferrer">
              <span className="reels-all-icon">{I.playCircle}</span>
              Watch All Reels
              <span className="reels-all-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="reels-stage">
          <div className="reel-track" ref={trackRef} aria-label="Featured reels">
            {items.map((reel, index) => (
              <ReelCard
                key={reel.id}
                reel={reel}
                index={index}
                reducedMotion={reducedMotion}
                isDemo={isDemo}
                isPlaying={playingId === reel.id}
                auto={manual === null}
                userPause={manual === 'paused'}
                onToggle={toggle}
                onEnded={advance}
                onBlocked={() => setManual('paused')}
                photo={creator.photo}
                handle={handle}
                liked={likes.includes(reel.id)}
                onLike={toggleLike}
              />
            ))}
          </div>
        </div>

        {showDots && (
          items.length <= 10 ? (
            <div className="reel-dots" role="tablist" aria-label="Choose reel">
              {items.map((reel, index) => (
                <button
                  key={reel.id}
                  type="button"
                  className={`reel-dot${index === active ? ' active' : ''}`}
                  onClick={() => goTo(index)}
                  aria-label={`Go to reel ${index + 1}`}
                  aria-selected={index === active}
                  role="tab"
                />
              ))}
            </div>
          ) : (
            <p className="reel-counter">{active + 1} / {items.length}</p>
          )
        )}

        {(error || isDemo) && (
          <p className="reels-note" role={error ? 'status' : undefined}>
            <span>
              <span className="reels-note-icon" aria-hidden="true">{I.camera}</span>
              {error
                ? `${error} Showing demo reels for now.`
                : 'Demo previews link to Instagram. Upload and publish videos in Admin to play them here.'}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
