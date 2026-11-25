import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cld } from '../../lib/cloudinary.js';
import { iconFor, money, offerInfo, parseStay } from '../../lib/stay-content.js';
import Icon from './stay-icons.jsx';
import './property-gallery.css';

const Chevron = ({ dir }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

// Copy text without the Clipboard API (older browsers / non-secure pages).
function legacyCopy(text) {
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(box);
  box.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  box.remove();
  return ok;
}

export default function PropertyGallery({ property, images, waHref, onEnquire, onClose }) {
  const [index, setIndex] = useState(0);
  const [contain, setContain] = useState({}); // photo index -> true when the photo is portrait and must not be cropped
  const [toast, setToast] = useState('');
  const [full, setFull] = useState(false);
  const count = images.length;
  const dialogRef = useRef(null);
  const stageRef = useRef(null);
  const closeRef = useRef(null);
  const thumbsRef = useRef(null);
  const toastTimer = useRef(null);
  const touchX = useRef(null);
  const go = useCallback((step) => setIndex((i) => (count ? (i + step + count) % count : 0)), [count]);

  const info = useMemo(() => parseStay(property.description, count), [property.description, count]);
  const offer = offerInfo(property.price, property.original_price);
  const chips = info.highlights.length ? info.highlights.slice(0, 4) : [property.tag, property.category].filter(Boolean);
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  const flash = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  };

  // Lock page scroll while open and give focus back to the card afterwards.
  useEffect(() => {
    const opener = document.activeElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      clearTimeout(toastTimer.current);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Fetch the neighbouring photos ahead of time so flipping through them never shows a blank frame.
  useEffect(() => {
    if (count < 2) return;
    [1, -1].forEach((step) => {
      const photo = new Image();
      photo.src = cld(images[(index + step + count) % count], 1600);
    });
  }, [index, images, count]);

  // Keyboard: Esc closes, arrows change photo, Tab stays inside the dialog.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') { if (!document.fullscreenElement) onClose(); }
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'Tab' && dialogRef.current) {
        const items = dialogRef.current.querySelectorAll('button:not([disabled]), a[href]');
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Warm up the neighbouring photos and keep the active thumbnail in view.
  useEffect(() => {
    if (!count) return;
    [1, -1].forEach((step) => {
      const next = images[(index + step + count) % count];
      if (next) new Image().src = cld(next, 1600);
    });
    const strip = thumbsRef.current;
    const active = strip?.children[index];
    if (strip && active) {
      strip.scrollTo({ left: active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2, behavior: 'smooth' });
    }
  }, [index, images, count]);

  const onTouchEnd = (event) => {
    if (touchX.current === null) return;
    const dx = event.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  const onPhotoLoad = (event) => {
    const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
    if (w && h > w * 1.05) setContain((state) => (state[index] ? state : { ...state, [index]: true }));
  };

  const share = async () => {
    const url = property.id ? `${location.origin}${location.pathname}?stay=${property.id}` : location.href;
    const data = { title: property.name, text: `${property.name}, ${property.location} on Staycation`, url };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (error) { if (error?.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash('Link copied');
    } catch {
      flash(legacyCopy(url) ? 'Link copied' : 'Could not copy the link');
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else stageRef.current?.requestFullscreen?.().catch(() => flash('Full screen is not available here'));
  };

  const showPhoto = (photo) => {
    setIndex(photo);
    // On phones the photo sits above the details, so bring it back into view.
    dialogRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const scrollThumbs = (step) => thumbsRef.current?.scrollBy({ left: step * 320, behavior: 'smooth' });

  const hasSections = info.structured;
  const priceText = offer ? offer.now : money(property.price);

  return (
    <div className="pg-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="pg-dialog" role="dialog" aria-modal="true" aria-label={`${property.name} details and photos`} ref={dialogRef}>
        <button type="button" className="pg-close" onClick={onClose} ref={closeRef} aria-label="Close gallery">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div className="pg-media">
          <div
            className="pg-stage"
            ref={stageRef}
            onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }}
            onTouchEnd={onTouchEnd}
          >
            {count ? (
              <>
                <img className="pg-bg" src={cld(images[index], 120)} alt="" aria-hidden="true" decoding="async" />
                <img
                  key={index}
                  className={`pg-photo${contain[index] ? ' contain' : ''}`}
                  src={cld(images[index], 1600)}
                  alt={`${property.name} photo ${index + 1}`}
                  onLoad={onPhotoLoad}
                  decoding="async"
                  draggable="false"
                />
              </>
            ) : (
              <p className="pg-empty">No photos yet</p>
            )}
            <div className="pg-shade" aria-hidden="true" />

            {count > 1 && <span className="pg-counter">{index + 1} / {count}</span>}
            <div className="pg-tools">
              <button type="button" className="pg-tool" onClick={share} aria-label="Share this stay"><Icon name="share" /></button>
              {canFullscreen && count > 0 && (
                <button type="button" className="pg-tool" onClick={toggleFullscreen} aria-label={full ? 'Exit full screen' : 'View photo full screen'}>
                  <Icon name={full ? 'shrink' : 'expand'} />
                </button>
              )}
            </div>

            {count > 1 && (
              <>
                <button type="button" className="pg-arrow pg-prev" onClick={() => go(-1)} aria-label="Previous photo"><Chevron dir="left" /></button>
                <button type="button" className="pg-arrow pg-next" onClick={() => go(1)} aria-label="Next photo"><Chevron dir="right" /></button>
              </>
            )}

            <div className="pg-caption">
              <p className="pg-caption-title">{property.name}</p>
              <p className="pg-caption-loc"><Icon name="pin" /> {property.location}</p>
              {chips.length > 0 && (
                <ul className="pg-chips">
                  {chips.map((chip) => <li key={chip}><Icon name={iconFor(chip)} />{chip}</li>)}
                </ul>
              )}
            </div>
            {toast && <div className="pg-toast" role="status">{toast}</div>}
          </div>

          {count > 1 && (
            <div className="pg-strip">
              <button type="button" className="pg-strip-btn" onClick={() => scrollThumbs(-1)} aria-label="Scroll photos left"><Chevron dir="left" /></button>
              <div className="pg-thumbs" ref={thumbsRef}>
                {images.map((url, i) => (
                  <button
                    type="button"
                    key={`${url}-${i}`}
                    className={i === index ? 'active' : ''}
                    onClick={() => setIndex(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === index}
                  >
                    <img src={cld(url, 220)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
              <button type="button" className="pg-strip-btn" onClick={() => scrollThumbs(1)} aria-label="Scroll photos right"><Chevron dir="right" /></button>
            </div>
          )}
        </div>

        <div className="pg-info">
          <div className="pg-scroll">
            <header className="pg-head">
              <h2>{property.name}</h2>
              <span className="pg-rule" aria-hidden="true" />
            </header>

            {hasSections
              ? info.intro.map((text) => <p className="pg-intro" key={text}>{text}</p>)
              : <p className="pg-intro pg-plain">{info.plain || 'Message the host on WhatsApp for details, availability and the final price.'}</p>}

            {property.price && (
              <div className={`pg-price${offer ? ' has-offer' : ''}`}>
                <div className="pg-price-main">
                  {offer && <span className="pg-price-label">Offer price</span>}
                  <div className="pg-price-line">
                    {offer && <s className="pg-was"><span className="pg-sr">Original price </span>{offer.was}</s>}
                    <b className="pg-now">{priceText}</b>
                    <small>/ day</small>
                  </div>
                </div>
                {offer && <span className="pg-save">Save {offer.save}</span>}
              </div>
            )}

            {info.packages.length > 0 && (
              <section className="pg-sec" aria-label="Our packages">
                <div className="pg-sec-head">
                  <h3><Icon name="bed" /> Our Packages</h3>
                  <span className="pg-hint">Choose the stay that fits your group</span>
                </div>
                <div className="pg-packages">
                  {info.packages.map((pkg) => {
                    const hasPhoto = pkg.photo !== null && images[pkg.photo];
                    const body = (
                      <>
                        <span className="pg-pkg-img">
                          {hasPhoto
                            ? <img src={cld(images[pkg.photo], 520)} alt="" loading="lazy" />
                            : <span className="pg-pkg-ph"><Icon name={iconFor(pkg.name)} strokeWidth={1.5} /></span>}
                        </span>
                        <span className="pg-pkg-name">{pkg.name}</span>
                        {pkg.who && <span className="pg-pkg-who"><Icon name="users" />{pkg.who}</span>}
                      </>
                    );
                    return hasPhoto ? (
                      <button type="button" className="pg-pkg" key={pkg.name} onClick={() => showPhoto(pkg.photo)} aria-label={`${pkg.name}, ${pkg.who}. Show its photo`}>{body}</button>
                    ) : (
                      <div className="pg-pkg" key={pkg.name}>{body}</div>
                    );
                  })}
                </div>
              </section>
            )}

            {info.also.length > 0 && (
              <section className="pg-also" aria-label="Also available">
                <h3><Icon name="tent" /> Also Available</h3>
                <ul>
                  {info.also.map((item) => (
                    <li key={item.label}>
                      <Icon name={iconFor(`${item.label} ${item.sub}`)} />
                      <span>{item.label}{item.sub && <small>({item.sub})</small>}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {info.todo.length > 0 && (
              <section className="pg-todo" aria-label="Things to do">
                <h3><Icon name="leaf" /> Things to Do</h3>
                <ul>
                  {info.todo.map((item) => (
                    <li key={item.label}>
                      <Icon name={iconFor(item.label)} strokeWidth={1.6} />
                      <b>{item.label}</b>
                      {item.sub && <small>({item.sub})</small>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {info.extra.map((block) => (
              <section className="pg-extra" key={block.title}>
                <h3>{block.title}</h3>
                <ul>{block.items.map((item) => <li key={item}><Icon name="check" strokeWidth={2.4} />{item}</li>)}</ul>
              </section>
            ))}

            {hasSections && info.notes.map((text) => (
              <div className="pg-banner" key={text}>
                <span className="pg-banner-icon"><Icon name="bed" /></span>
                <p>{text}</p>
                <svg className="pg-banner-art" viewBox="0 0 80 44" aria-hidden="true">
                  <path d="M6 42L28 10l22 32z" fill="#2f7d3a" />
                  <path d="M28 10l22 32H33z" fill="#256a30" />
                  <path d="M22 42l6-12 6 12z" fill="#f5d896" />
                  <path d="M54 42V30M54 30l-7 8M54 24l8 9M54 18l-6 7" stroke="#e8923a" strokeWidth="3" strokeLinecap="round" fill="none" />
                  <path d="M60 42l8-16 8 16z" fill="#e8923a" />
                </svg>
              </div>
            ))}
          </div>

          <div className="pg-foot">
            <a className="pg-cta" href={waHref} target="_blank" rel="noreferrer" onClick={onEnquire}>
              <Icon name="whatsapp" strokeWidth={1.9} />
              <span>Enquire on WhatsApp</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
            </a>
            <p className="pg-note">Availability and final price are confirmed directly by the owner.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
