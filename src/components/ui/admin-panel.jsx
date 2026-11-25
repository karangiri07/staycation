import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cld } from '../../lib/cloudinary.js';
import { CREATOR_DEFAULTS, useCreator } from '../../lib/creator.js';
import { money, offerInfo } from '../../lib/stay-content.js';
import AIcon from './admin-icons.jsx';
import { AttentionBanner, DashboardView, SettingsCard } from './admin-dashboard.jsx';
import { TOKEN_KEY, detailOf, useAdminCall, useDebounced } from './admin-api.js';
import { PropertiesCard, ReelsCard } from './admin-lists.jsx';
import { CreatorCard, SignupsCard } from './creator-admin.jsx';
import PropertyImagesField from './property-images-field.jsx';
import './admin-panel.css';

const BLANK = { name: '', category: 'Villa', location: '', price: '', original_price: '', tag: '', description: '', image_url: '', image_public_id: '', images: [], published: true };
// Every sidebar entry opens its own pane, so nothing needs scrolling to reach it.
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'properties', label: 'Properties', icon: 'home' },
  { key: 'reels', label: 'Reels', icon: 'reels' },
  { key: 'creator', label: 'Creator Profile', icon: 'user' },
  { key: 'contact', label: 'Contact & Footer', icon: 'mail' },
  { key: 'settings', label: 'Settings', icon: 'gear' },
];
const PANES = NAV.map((item) => item.key);
const firstPane = () => { try { const key = window.location.hash.replace('#', ''); return PANES.includes(key) ? key : 'properties'; } catch { return 'properties'; } };

// Palm silhouettes over orange hills (sidebar footer). Fronds are leaf shapes generated from a few numbers.
function palm(x, base, height, lean, scale) {
  const cx = x + lean; const cy = base - height;
  const trunk = `M${x - 2.4 * scale} ${base}Q${x + lean * 0.1} ${base - height * 0.55} ${cx - 1.3 * scale} ${cy}L${cx + 1.3 * scale} ${cy}Q${x + lean * 0.1 + 4 * scale} ${base - height * 0.55} ${x + 2.4 * scale} ${base}Z`;
  const blades = [-172, -148, -122, -96, -68, -42, -16].map((deg) => {
    const a = (deg * Math.PI) / 180; const len = (deg > -125 && deg < -60 ? 22 : 30) * scale;
    const ex = cx + Math.cos(a) * len; const ey = cy + Math.sin(a) * len + len * 0.5;
    const upX = cx + Math.cos(a) * len * 0.55; const upY = cy + Math.sin(a) * len * 0.55 - len * 0.32;
    const lowY = cy + Math.sin(a) * len * 0.55 + len * 0.02;
    return `M${cx} ${cy}Q${upX.toFixed(1)} ${upY.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}Q${upX.toFixed(1)} ${lowY.toFixed(1)} ${cx} ${cy}Z`;
  });
  return `${trunk}${blades.join('')}`;
}
const PALM_PATH = `${palm(44, 150, 96, -8, 1.25)}${palm(92, 150, 64, 6, 0.9)}${palm(170, 150, 54, -5, 0.8)}`;

function Palms() {
  return (
    <svg className="ad-palms" viewBox="0 0 218 150" aria-hidden="true">
      <defs>
        <linearGradient id="ad-hill-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6a24a" stopOpacity="0.9" /><stop offset="1" stopColor="#c4511c" /></linearGradient>
        <linearGradient id="ad-hill-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef7a2b" /><stop offset="1" stopColor="#a8401a" /></linearGradient>
        <radialGradient id="ad-glow" cx="0.72" cy="0.5" r="0.6"><stop offset="0" stopColor="#f08a2c" stopOpacity="0.35" /><stop offset="1" stopColor="#f08a2c" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="218" height="150" fill="url(#ad-glow)" />
      <path d="M0 96C34 80 62 74 98 86S170 70 218 82V150H0Z" fill="url(#ad-hill-a)" opacity="0.7" />
      <path d="M0 120C40 104 84 112 124 104S190 96 218 104V150H0Z" fill="url(#ad-hill-b)" />
      <path d={PALM_PATH} fill="#0b1426" />
      <path d="M0 140C60 132 120 142 218 134V150H0Z" fill="#0b1426" />
    </svg>
  );
}

export default function AdminPanel({ api = '' }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const [view, setView] = useState(firstPane);
  const [notice, setNotice] = useState({ kind: '', text: '' });
  const [number, setNumber] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [menu, setMenu] = useState(false);
  const [signupsOpen, setSignupsOpen] = useState(true);
  const [meta, setMeta] = useState({ stats: null, status: null, error: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const [avatar, setAvatar] = useState(null);
  const creator = useCreator(api);
  const query = useDebounced(searchText.trim(), 300);

  // Keep this page out of search engines, and never let the browser cache or translate the panel.
  useEffect(() => {
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex, nofollow, noarchive';
    const previous = document.title; document.title = 'Staycation CMS';
    document.head.appendChild(meta);
    return () => { meta.remove(); document.title = previous; };
  }, []);
  const menuRef = useRef(null);
  const noticeTimer = useRef(null);
  const navRef = useRef(null);

  const notify = useCallback((kind, text) => {
    clearTimeout(noticeTimer.current);
    setNotice({ kind, text });
    if (kind === 'ok') noticeTimer.current = setTimeout(() => setNotice({ kind: '', text: '' }), 7000);
  }, []);

  const startSession = useCallback((value) => { localStorage.setItem(TOKEN_KEY, value); tokenRef.current = value; setToken(value); }, []);
  const endSession = useCallback((message) => {
    localStorage.removeItem(TOKEN_KEY); tokenRef.current = ''; setToken('');
    setMenu(false); setMeta({ stats: null, status: null, error: '' });
    setNotice(message ? { kind: 'error', text: message } : { kind: '', text: '' });
  }, []);
  const expired = useCallback(() => endSession('Your session ended, so please sign in again. Anything you typed is still here.'), [endSession]);
  const call = useAdminCall(api, tokenRef, expired);
  const bump = useCallback(() => setReloadKey((n) => n + 1), []);

  const loadMeta = useCallback(async () => {
    try {
      const [stats, status] = await Promise.all([call('/api/admin/stats'), call('/api/admin/status')]);
      if (stats.status === 404) { setMeta({ stats: null, status: null, error: 'The backend is still the old version, so the dashboard has no numbers. Replace the backend files, restart it, then press Try again.' }); return; }
      if (!stats.ok) throw Error(detailOf(stats.data, stats.status));
      setMeta({ stats: stats.data, status: status.ok ? status.data : null, error: '' });
    } catch (error) { if (error.message !== 'expired') setMeta((m) => ({ ...m, error: error.message })); }
  }, [call]);

  useEffect(() => {
    if (!token) return undefined;
    loadMeta();
    call('/api/admin/config').then(({ ok, data }) => { if (ok) setNumber(data.whatsapp_number || ''); }).catch(() => {});
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token ? 'in' : 'out', reloadKey]);

  // Keep the session alive while the panel is open, so a long listing is never lost to an expired login.
  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(() => { call('/api/admin/refresh', { method: 'POST' }).then(({ ok, data }) => { if (ok && data.access_token) startSession(data.access_token); }).catch(() => {}); }, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [token ? 'in' : 'out', call, startSession]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!menu) return undefined;
    const away = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setMenu(false); };
    const esc = (event) => { if (event.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [menu]);

  // Open a pane: show only that section, from the top, and remember it in the address so a refresh stays here.
  const open = useCallback((key) => {
    setView(key);
    window.scrollTo({ top: 0 });
    try { window.history.replaceState(null, '', `#${key}`); } catch { /* ignore */ }
    if (key === 'dashboard') loadMeta();
  }, [loadMeta]);
  const goTo = (item) => open(item.key);

  // On a phone the sidebar is a sideways strip: keep the open pane's button in sight.
  useEffect(() => {
    navRef.current?.querySelector('button.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [view, token]);

  /* ---------- sign in ---------- */
  const signIn = async (event) => {
    event.preventDefault();
    const { username, password } = event.target;
    setSaving(true);
    try {
      const { ok, status, data } = await call('/api/auth/login', { method: 'POST', body: { username: username.value, password: password.value } });
      if (!ok) throw Error(detailOf(data, status));
      setNotice({ kind: '', text: '' }); startSession(data.access_token);
    } catch (error) { if (error.message !== 'expired') setNotice({ kind: 'error', text: error.message || 'Could not sign in' }); }
    setSaving(false);
  };

  /* ---------- property form ---------- */
  const saveProperty = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const photos = form.images || [];
      const cover = photos[0];
      const payload = { ...form, image_url: cover ? cover.url : '', image_public_id: cover ? (cover.public_id || '') : '' };
      const { ok, status, data } = await call(`/api/admin/properties${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', body: payload });
      if (!ok) throw Error(detailOf(data, status));
      const saved = Array.isArray(data.images) ? data.images.length : 0;
      if (photos.length && saved < photos.length) {
        if (!editing && data.id) setEditing(data.id);
        notify('warn', `Saved, but the server kept only ${saved} of ${photos.length} photos. Your entries are still below. Check the backend is the latest version, then press Save changes again.`);
      } else {
        notify('ok', `${editing ? 'Changes saved' : 'Property created'}${photos.length ? ` with ${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''}. ${form.published ? 'It is live on the website.' : 'It is a draft, so visitors cannot see it yet.'}`);
        setForm(BLANK); setEditing(null);
      }
      bump();
    } catch (error) { if (error.message !== 'expired') notify('error', `Could not save the property: ${error.message}`); }
    setSaving(false);
  };
  const editProperty = (p) => {
    setEditing(p.id);
    setForm({
      name: p.name, category: p.category, location: p.location, price: p.price, original_price: p.original_price || '', tag: p.tag || '', description: p.description || '',
      image_url: p.image_url || '', image_public_id: p.image_public_id || '',
      images: (p.images && p.images.length) ? p.images.map((x) => ({ url: x.url, public_id: x.public_id || '' })) : (p.image_url ? [{ url: p.image_url, public_id: p.image_public_id || '' }] : []),
      published: p.published,
    });
    open('properties');
  };
  const cancelEdit = () => { setForm(BLANK); setEditing(null); };

  /* ---------- WhatsApp ---------- */
  const saveConfig = async (event) => {
    event.preventDefault();
    try {
      const { ok, status, data } = await call('/api/admin/config', { method: 'PUT', body: { whatsapp_number: number } });
      if (!ok) throw Error(detailOf(data, status));
      setNumber(data.whatsapp_number || number); notify('ok', 'WhatsApp number saved. Enquire buttons now open this number.'); bump();
    } catch (error) { if (error.message !== 'expired') notify('error', `Could not save the number: ${error.message}`); }
  };

  const offer = useMemo(() => offerInfo(form.price, form.original_price), [form.price, form.original_price]);
  const priceHint = offer
    ? `Visitors see ${offer.was} crossed out, ${offer.now} as the price and “Save ${offer.save}”.`
    : form.original_price
      ? 'The original price must be higher than the offer price, otherwise no discount is shown.'
      : `Fill this only for an offer. Visitors see ${money('₹2800')} crossed out, ${money('₹2600')} as the price and “Save ₹200”.`;
  const photoOf = avatar ?? creator.photo ?? CREATOR_DEFAULTS.photo;
  const newToday = meta.stats?.subscribers?.today || 0;

  /* ---------- login screen ---------- */
  if (!token) {
    return (
      <div className="ad-login">
        <form className="ad-login-card" onSubmit={signIn}>
          <a className="ad-logo" href="/"><span className="ad-mark">S</span>Stay<span>cation</span></a>
          <h1>Admin sign in</h1>
          <p className="ad-sub">Sign in to manage your stays, reels and creator profile.</p>
          <label className="ad-field">Username<input name="username" autoComplete="username" required autoFocus /></label>
          <label className="ad-field">Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="ad-btn ad-primary ad-block" disabled={saving}>{saving ? 'Signing in…' : 'Sign in'}</button>
          {notice.text && <p className={`ad-inline ${notice.kind}`} role="alert">{notice.text}</p>}
          <small>Only the site owner can sign in. After 5 wrong passwords this device is blocked for 15 minutes.</small>
        </form>
      </div>
    );
  }

  return (
    <div className="ad-root" id="ad-top">
      <aside className="ad-side">
        <a className="ad-logo" href="/" title="Open the website"><span className="ad-mark">S</span>Stay<span>cation</span></a>
        <nav className="ad-nav" aria-label="Admin sections" ref={navRef}>
          {NAV.map((item) => (
            <button key={item.key} type="button" className={view === item.key ? 'on' : ''} aria-current={view === item.key ? 'page' : undefined} onClick={() => goTo(item)}>
              <AIcon name={item.icon} size={21} />{item.label}
            </button>
          ))}
        </nav>
        <div className="ad-side-foot">
          <Palms />
          <div className="ad-side-note">
            <b>Staycation CMS</b>
            <span>Manage stays, reels and creator settings for Maharashtra.</span>
          </div>
        </div>
      </aside>

      <div className="ad-main">
        <header className="ad-top">
          <div className="ad-title">
            <h1>Staycation CMS
              <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 17 15 21M11 6 17 14M24 3 24 13" stroke="#f08a2c" strokeWidth="3.2" strokeLinecap="round" fill="none" /></svg>
            </h1>
            <p>Manage your stays, reels and creator profile.</p>
          </div>
          <div className="ad-tools">
            <label className="ad-search">
              <AIcon name="search" size={19} />
              <span className="ad-sr">Search properties and reels</span>
              <input type="search" placeholder="Search properties, reels..." value={searchText} onChange={(e) => { setSearchText(e.target.value); if (e.target.value && view !== 'properties' && view !== 'reels') open('properties'); }} />
            </label>
            <button type="button" className="ad-bell" aria-label={newToday ? `${newToday} new email sign-ups today` : 'Email sign-ups'} title={newToday ? `${newToday} new sign-ups today` : 'Email sign-ups'}
              onClick={() => { setSignupsOpen(true); open('contact'); }}>
              <AIcon name="bell" size={21} />{newToday > 0 && <i className="ad-dot" />}
            </button>
            <div className="ad-who" ref={menuRef}>
              <button type="button" className="ad-who-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                <img src={cld(photoOf, 96)} alt="" />
                <b>Admin</b>
                <AIcon name="down" size={17} />
              </button>
              {menu && (
                <div className="ad-menu" role="menu">
                  <a role="menuitem" href="/" target="_blank" rel="noreferrer"><AIcon name="external" size={17} />View website</a>
                  <button role="menuitem" type="button" onClick={() => { setMenu(false); open('settings'); }}><AIcon name="gear" size={17} />Settings</button>
                  <button role="menuitem" type="button" onClick={() => endSession('')}><AIcon name="logout" size={17} />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {notice.text && (
          <div className={`ad-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
            <AIcon name={notice.kind === 'ok' ? 'check' : 'alert'} size={19} />
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice({ kind: '', text: '' })} aria-label="Dismiss message"><AIcon name="close" size={16} /></button>
          </div>
        )}
        <AttentionBanner status={meta.status} onOpenSettings={() => open('settings')} />

        {view === 'dashboard' && (
          <DashboardView meta={meta} onRefresh={loadMeta} onOpenSettings={() => open('settings')} onOpenSignups={() => { setSignupsOpen(true); open('contact'); }}
            onOpenProperties={() => open('properties')} onOpenReels={() => open('reels')} />
        )}

        {/* The panes below stay mounted (just hidden) so anything half-typed is kept when you switch sections. */}
        {/* ---------- Properties: add / edit form + the list ---------- */}
        <div className="ad-grid" hidden={view !== 'properties'}>
          <div className="ad-col">
            <form className="ad-card" id="ad-form" onSubmit={saveProperty}>
              <div className="ad-card-head">
                <span className="ad-tile"><AIcon name="home" size={26} /></span>
                <div>
                  <h2>{editing ? 'Edit Property' : 'Add New Property'}</h2>
                  <p>{editing ? 'Update this listing, then save your changes.' : 'Create a new staycation property listing.'}</p>
                </div>
              </div>

              <label className="ad-field">Name <b className="req">*</b><input required maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <div className="ad-two">
                <label className="ad-field">Category <b className="req">*</b>
                  <span className="ad-select"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{['Villa', 'Farmhouse', 'Resort'].map((x) => <option key={x}>{x}</option>)}</select><AIcon name="down" size={17} /></span>
                </label>
                <label className="ad-field">Location <b className="req">*</b><input required maxLength={180} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
              </div>
              <div className="ad-two">
                <label className="ad-field">Price (offer / current price) <b className="req">*</b><input required maxLength={60} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="₹2600" /></label>
                <label className="ad-field">Original price (shown crossed out, optional)<input maxLength={60} value={form.original_price || ''} onChange={(e) => setForm({ ...form, original_price: e.target.value })} placeholder="₹2800" /></label>
              </div>
              <p className={`ad-hint${form.original_price && !offer ? ' warn' : ''}`}>{priceHint}</p>
              <label className="ad-field">Tag<input maxLength={80} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Family Fun" /></label>
              <label className="ad-field">Description
                <textarea rows={9} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <small className="ad-count-note">{(form.description || '').length.toLocaleString('en-IN')} / 5,000</small>
              </label>
              <details className="ad-tips">
                <summary>How to lay out the description</summary>
                <p>Write a short intro, then the headings Highlights, Our packages, Also available and Things to do, each followed by lines starting with •. A package line looks like: Name: for 2 to 7 people [photo 3] (the photo number is optional). A last plain line becomes a highlighted note.</p>
              </details>

              <PropertyImagesField images={form.images || []} update={(fn) => setForm((v) => ({ ...v, images: fn(v.images || []) }))} token={token} api={api} onUnauthorized={expired} />

              <label className="ad-switch">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                <span className="ad-track" aria-hidden="true" />
                <b>{form.published ? 'Published' : 'Draft'}</b>
              </label>

              <div className="ad-actions">
                <button className="ad-btn ad-primary" type="submit" disabled={saving}>
                  <AIcon name={editing ? 'save' : 'plusCircle'} size={19} />{saving ? 'Saving…' : editing ? 'Save changes' : 'Create Property'}
                </button>
                {editing && <button type="button" className="ad-btn ad-ghost" onClick={cancelEdit}>Cancel edit</button>}
              </div>
            </form>
          </div>
          <div className="ad-col">
            <PropertiesCard call={call} notify={notify} query={query} reloadKey={reloadKey} editingId={editing} onEdit={editProperty} onDeleted={(id) => { if (editing === id) cancelEdit(); }} onChanged={bump} />
          </div>
        </div>

        {/* ---------- Reels ---------- */}
        <div className="ad-pane" hidden={view !== 'reels'}>
          <ReelsCard call={call} notify={notify} token={token} api={api} query={query} reloadKey={reloadKey} onChanged={bump} />
        </div>

        {/* ---------- Creator profile ---------- */}
        <div className="ad-pane" hidden={view !== 'creator'}>
          <CreatorCard api={api} call={call} onSaved={(data) => setAvatar(data.photo || CREATOR_DEFAULTS.photo)} />
        </div>

        {/* ---------- Contact & footer: WhatsApp number + email sign-ups ---------- */}
        <div className="ad-pane" hidden={view !== 'contact'}>
          <form className="ad-card ad-contact" id="ad-contact" onSubmit={saveConfig}>
            <span className="ad-tile green"><AIcon name="whatsapp" size={25} /></span>
            <div className="ad-contact-copy">
              <h2>WhatsApp Contact</h2>
              <p>Update the WhatsApp number for enquiries.</p>
            </div>
            <label className="ad-contact-input">
              <span className="ad-sr">WhatsApp number in international format</span>
              <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="919876543210" inputMode="tel" maxLength={20} />
            </label>
            <button className="ad-btn ad-primary" type="submit"><AIcon name="save" size={18} />Save Contact Settings</button>
          </form>
          <SignupsCard api={api} call={call} token={token} notify={notify} open={signupsOpen} onToggle={() => setSignupsOpen(!signupsOpen)} reloadKey={reloadKey} onChanged={bump} />
        </div>

        {/* ---------- Settings ---------- */}
        <div className="ad-pane" hidden={view !== 'settings'}>
          <SettingsCard api={api} call={call} token={token} notify={notify} reloadKey={reloadKey} onChanged={bump}
            onNewToken={startSession} onSignOut={() => endSession('')} onSignOutEverywhere={() => endSession('You were signed out on every device. Sign in again to continue.')} />
        </div>
      </div>
    </div>
  );
}
