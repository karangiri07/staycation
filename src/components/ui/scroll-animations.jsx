import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { properties } from '../../data.js';
import { cld } from '../../lib/cloudinary.js';

// Hero photos only show at card size, so small copies are plenty (and much lighter to decode).
const HERO_PHOTO = 640;

function TunnelCard({ item, index, total, progress, fade }) {
  const start = (index / total) * 0.58;
  const localProgress = useTransform(progress, [start, start + 0.48], [0, 1]);
  const z = useTransform(localProgress, [0, 1], [-1500, 280]);
  const cardOpacity = useTransform(
    localProgress,
    [0, 0.16, 0.76, 1],
    [0, 1, 1, 0],
  );
  // The fade-out is folded into each card. Fading the 3D parent instead would flatten it
  // (opacity < 1 disables preserve-3d), so every card would pop out of perspective.
  const opacity = useTransform([cardOpacity, fade], ([own, all]) => own * all);
  const angle = index * 137.5 * (Math.PI / 180);
  const offsetX = Math.cos(angle) * (18 + (index % 3) * 5);
  const offsetY = Math.sin(angle) * (13 + (index % 2) * 7);
  const rotation = (index % 2 ? -1 : 1) * (3 + (index % 4) * 2);

  // Position and tilt never change, so they live in CSS (see .tunnel-card).
  // Only depth is animated, which keeps the per-frame style string tiny.
  return (
    <motion.article
      className="tunnel-card"
      style={{
        '--tx': `${offsetX}vw`,
        '--ty': `${offsetY}vh`,
        '--rot': `${rotation}deg`,
        z,
        opacity,
        zIndex: index + 1,
      }}
      aria-label={item.name}
    >
      <img src={cld(item.image, HERO_PHOTO)} alt="" draggable="false" decoding="async" />
      <span>{item.name}</span>
    </motion.article>
  );
}

// The row is shown twice, side by side. Sliding it by exactly one copy and starting over looks
// identical, so it can run for ever. The tilt is a gentle wave that repeats after one copy.
const rowTilt = (index, count) => 12 * Math.sin((((index % count) + 0.5) / count) * Math.PI * 2);

function CurvedPropertyRow({ images, reach, auto }) {
  const opacity = useTransform(reach, [0.52, 0.7], [0, 1]);
  const x = useTransform(reach, [0.52, 0.8], ['24vw', '0vw']);
  const scale = useTransform(reach, [0.52, 0.76], [0.88, 1]);
  const loop = [...images, ...images];

  return (
    <motion.div className="curved-property-row" style={{ opacity }}>
      <motion.div className="curved-property-track" style={{ x, scale }}>
        <div className={`curved-property-marquee${auto ? ' is-auto' : ''}`}>
          {loop.map((item, index) => {
            const copy = index >= images.length;

            return (
              <article
                className="curved-property-card"
                key={`${item.name}-${index}`}
                aria-hidden={copy ? 'true' : undefined}
                style={{ '--tile-tilt': `${rowTilt(index, images.length).toFixed(1)}deg` }}
              >
                <img src={cld(item.image, HERO_PHOTO)} alt={copy ? '' : item.name} draggable="false" decoding="async" />
                <span>{item.name}</span>
              </article>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ScrollHero() {
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const reducedMotion = useReducedMotion();
  // No spring on top of the scroll: the browser already eases the wheel, and a spring keeps
  // re-rendering the whole scene for a second or two after the page has stopped moving.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });
  // The identity function keeps every effect below on the normal JS path. Linking them straight
  // to the scroll value lets framer-motion hand short ranges (like 0 to 0.68) to the browser's
  // native scroll timeline, which then fades the title back in after the animation ends.
  const progress = useTransform(scrollYProgress, (value) => value);
  // The photos follow `reach`, the furthest point scrolled so far. Scrolling back up leaves them
  // where they are instead of playing them backwards. A refresh starts them again from zero.
  const reach = useMotionValue(0);
  useMotionValueEvent(progress, 'change', (value) => {
    if (value > reach.get()) reach.set(value);
  });
  // Once the row has slid into place it keeps moving on its own, one way only.
  const [auto, setAuto] = useState(false);
  useMotionValueEvent(reach, 'change', (value) => {
    if (value >= 0.8) setAuto(true);
  });
  const images = properties.slice(0, 6);
  const tunnelFade = useTransform(reach, [0, 0.62, 0.72], [1, 1, 0]);
  // The scene is locked in place: it plays forward to a final layout (headline, background and the
  // photo row) and then stays exactly like that. Everything below follows `reach`, so scrolling
  // back up changes nothing. The thin bar at the bottom fills forward only, too, and stays full.
  // The headline steps back while the photos fly past, then returns to full strength.
  const titleOpacity = useTransform(reach, [0, 0.26, 0.44, 0.62, 0.82], [1, 1, 0.22, 0.22, 1]);
  const titleY = useTransform(reach, [0, 0.44, 0.62, 0.82], ['0px', '-24px', '-24px', '0px']);
  const backgroundScale = useTransform(reach, [0, 0.8], [1, 1.1]);
  const barFill = useTransform(reach, [0, 0.82], [0, 1]);

  // After a refresh the page should start at the top so the photos play again from the beginning.
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    try { window.history.scrollRestoration = 'manual'; } catch { /* ignore */ }
    if (!window.location.hash) window.scrollTo(0, 0);
    return () => {
      try { window.history.scrollRestoration = previous; } catch { /* ignore */ }
    };
  }, []);

  // On phones the photo row sits right under the headline block, whatever height the text ends up
  // with on that screen (font loading and in-app browsers can change how it wraps).
  useEffect(() => {
    const stage = stageRef.current;
    const copy = stage ? stage.querySelector('.scroll-hero-copy') : null;
    if (!stage || !copy) return undefined;
    const measure = () => stage.style.setProperty('--copy-b', `${copy.offsetTop + copy.offsetHeight}px`);
    measure();
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (watcher) watcher.observe(copy);
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});
    return () => {
      if (watcher) watcher.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Decode the hero photos before the first scroll so cards don't stutter when they appear.
  useEffect(() => {
    images.forEach((item) => {
      const photo = new Image();
      photo.decoding = 'async';
      photo.src = cld(item.image, HERO_PHOTO);
      photo.decode?.().catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="scroll-hero" id="home" ref={sectionRef}>
      <div className="scroll-hero-stage" ref={stageRef}>
        <motion.div
          className="scroll-hero-background"
          style={{ scale: backgroundScale }}
        />
        <div className="scroll-hero-shade" />
        <motion.div
          className="scroll-hero-copy wrap"
          style={{ opacity: titleOpacity, y: titleY }}
        >
          <span className="eyebrow">✦ CREATOR CURATED GETAWAYS</span>
          <h1>
            Somewhere new
            <br />
            is <em>closer than you think.</em>
          </h1>
          <p>
            Handpicked villas, farmhouses and resorts across Maharashtra.
            Find your escape, then connect directly with the host.
          </p>
          <a className="btn" href="#explore">
            Explore villas <span>→</span>
          </a>
        </motion.div>
        <div className="tunnel-layer">
          {images.map((item, index) => (
            <TunnelCard
              key={item.name}
              item={item}
              index={index}
              total={images.length}
              progress={reach}
              fade={tunnelFade}
            />
          ))}
        </div>
        <CurvedPropertyRow images={images} reach={reach} auto={auto && !reducedMotion} />
        <motion.div
          className="scroll-hero-hint"
          style={{ opacity: titleOpacity }}
          aria-hidden="true"
        >
          SCROLL TO REVEAL THE STAYS <span>↓</span>
        </motion.div>
        <motion.div
          className="scroll-hero-progress"
          style={{ scaleX: barFill }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

export function ScrollReveals() {
  useEffect(() => {
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      return undefined;
    }

    const elements = document.querySelectorAll(
      '.trust > div, .creator-card, #explore .section-head, #explore .searchbox, #explore .filters, #explore .cards, .how .section-head, .how .step, .reels-section .section-head, .owner, footer',
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('scroll-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    elements.forEach((element) => {
      element.classList.add('scroll-reveal');
      observer.observe(element);
    });
    document.documentElement.classList.add('scroll-reveal-ready');

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('scroll-reveal-ready');
    };
  }, []);

  return null;
}
