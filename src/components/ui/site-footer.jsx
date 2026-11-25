import { useState } from 'react';
import { handleOf } from '../../lib/creator.js';
import './site-footer.css';

const Icon = {
  youtube: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="5" width="21" height="14.5" rx="4.4" fill="#ff2d4a" /><path d="M10 9.3v5.9l5.3-2.95z" fill="#fff" /></svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r="1" fill="#fff" stroke="none" /></svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 8 8 5.5L20 8" /></svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
};

export default function SiteFooter({ creator, api = '', listHref = '#partners' }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ kind: 'idle', text: '' });
  const year = new Date().getFullYear();
  const mailto = `mailto:${creator.email}`;

  const subscribe = async (event) => {
    event.preventDefault();
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)) {
      setState({ kind: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    setState({ kind: 'sending', text: 'Subscribing…' });
    try {
      const response = await fetch(`${api}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      if (response.ok) {
        setEmail('');
        setState({ kind: 'done', text: "You're on the list. We'll share new stays and reels with you." });
      } else if (response.status === 429) {
        setState({ kind: 'error', text: 'Too many attempts. Please try again in a few minutes.' });
      } else if (response.status === 422) {
        setState({ kind: 'error', text: 'Please enter a valid email address.' });
      } else {
        setState({ kind: 'error', text: `Sign-ups are not available right now. You can email us at ${creator.email}.` });
      }
    } catch {
      setState({ kind: 'error', text: 'Could not connect. Please check your internet and try again.' });
    }
  };

  return (
    <footer className="sf">
      <div className="wrap">
        <div className="sf-grid">
          <div className="sf-brand">
            <a className="logo sf-logo" href="#home"><span className="brand-mark">S</span>Stay<span>cation</span></a>
            <p>Discover handpicked villas, farmhouses and resorts across Maharashtra for your next perfect staycation.</p>
            <small>Each stay is owned and managed by its respective host.</small>
          </div>

          <nav className="sf-col" aria-label="Quick links">
            <h3>Quick Links</h3>
            <ul>
              <li><a href="#home">Home</a></li>
              <li><a href="#explore">Explore Stays</a></li>
              <li><a href="#reels">Reels</a></li>
              <li><a href="#creator">About Creator</a></li>
            </ul>
          </nav>

          <nav className="sf-col" aria-label="For owners">
            <h3>For Owners</h3>
            <ul>
              <li><a href={listHref} target="_blank" rel="noreferrer">List Your Property</a></li>
              <li><a href="#how">How It Works</a></li>
              <li><a href={`${mailto}?subject=${encodeURIComponent('Partnership with Staycation')}`}>Partner With Us</a></li>
            </ul>
          </nav>

          <div className="sf-col">
            <h3>Connect With Me</h3>
            <ul className="sf-connect">
              <li><a href={creator.youtube_url} target="_blank" rel="noreferrer"><span className="sf-ico">{Icon.youtube}</span>{handleOf(creator.youtube_url, 'YouTube')}</a></li>
              <li><a href={creator.instagram_url} target="_blank" rel="noreferrer"><span className="sf-ico">{Icon.instagram}</span>{handleOf(creator.instagram_url, '@vlogsbyarunn')}</a></li>
              <li><a href={mailto}><span className="sf-ico">{Icon.mail}</span>{creator.email}</a></li>
            </ul>
          </div>

          <form className="sf-col sf-news" onSubmit={subscribe} noValidate>
            <h3>Stay in the Loop</h3>
            <p>Get updates on new stays, travel reels and exclusive recommendations.</p>
            <div className="sf-field">
              <label htmlFor="sf-email" className="sf-sr">Your email address</label>
              <input
                id="sf-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); if (state.kind !== 'idle') setState({ kind: 'idle', text: '' }); }}
                aria-invalid={state.kind === 'error'}
                aria-describedby="sf-status"
              />
              <button type="submit" disabled={state.kind === 'sending'} aria-label="Subscribe">{Icon.arrow}</button>
            </div>
            <p id="sf-status" className={`sf-status ${state.kind}`} role="status" aria-live="polite">{state.text}</p>
          </form>
        </div>

        <div className="sf-bottom">
          <span><a href="/admin" className="sf-secret" tabIndex={-1} aria-hidden="true">©</a> {year} Staycation. All rights reserved.</span>
          <span>Made with <i className="sf-heart" aria-label="love">❤</i> by <a href={creator.instagram_url} target="_blank" rel="noreferrer">{handleOf(creator.instagram_url, '@vlogsbyarunn')}</a></span>
        </div>
      </div>
    </footer>
  );
}
