import { useEffect, useState } from 'react';
import { CREATOR_DEFAULTS } from '../../lib/creator.js';
import { cld } from '../../lib/cloudinary.js';
import AIcon from './admin-icons.jsx';
import { Pager } from './admin-lists.jsx';
import { detailOf, downloadFile, useDebounced, usePaged } from './admin-api.js';

/* ---------------- Creator profile card ---------------- */
export function CreatorCard({ api, call, onSaved, id = 'ad-creator' }) {
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${api}/api/public/creator`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((x) => setForm(x && typeof x === 'object' ? x : {}))
      .catch(() => {});
  }, [api]);

  const set = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const photo = form.photo || CREATOR_DEFAULTS.photo;
  const field = (key) => ({ value: form[key] || '', onChange: set(key), placeholder: CREATOR_DEFAULTS[key] || '(empty)' });

  const save = async (event) => {
    event.preventDefault();
    setBusy(true); setMsg({ kind: 'info', text: 'Saving…' });
    try {
      const keys = ['name', 'headline', 'bio', 'instagram_url', 'youtube_url', 'email', 'stat_instagram', 'stat_youtube', 'stat_views', 'photo'];
      const body = Object.fromEntries(keys.map((key) => [key, (form[key] || '').trim()]));
      const { ok, status, data } = await call('/api/admin/creator', { method: 'PUT', body });
      if (status === 404 || status === 405) throw Error('The backend is still the old version. Replace the backend files, restart it, then try again.');
      if (!ok) throw Error(detailOf(data, status));
      setForm(data);
      onSaved?.(data);
      setMsg({ kind: 'ok', text: 'Saved. Refresh the website to see the new creator card and footer.' });
    } catch (error) {
      if (error.message !== 'expired') setMsg({ kind: 'error', text: error.message || 'Could not save' });
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type) || file.size > 10 * 1024 * 1024) { setMsg({ kind: 'error', text: 'Use a JPG, PNG or WebP photo under 10 MB.' }); return; }
    setMsg({ kind: 'info', text: 'Uploading photo…' });
    const data = new FormData(); data.append('file', file);
    try {
      const { ok, status, data: result } = await call('/api/admin/upload/image', { method: 'POST', form: data });
      if (!ok) throw Error(detailOf(result, status));
      setForm((value) => ({ ...value, photo: result.url }));
      setMsg({ kind: 'ok', text: 'Photo uploaded. Press Save Creator & Footer to use it.' });
    } catch (error) {
      if (error.message !== 'expired') setMsg({ kind: 'error', text: error.message || 'Photo upload failed' });
    }
  };

  return (
    <div className="ad-card" id={id}>
      <div className="ad-card-head">
        <span className="ad-tile"><AIcon name="user" size={24} /></span>
        <div>
          <h2>Creator Profile</h2>
          <p>Update content creator details shown on the website.</p>
        </div>
      </div>

      <form onSubmit={save} className="cp">
        <div className="cp-top">
          <div className="cp-avatar">
            <img src={cld(photo, 260)} alt="Creator" />
            <label className="cp-camera" title="Change photo">
              <AIcon name="camera" size={17} />
              <span className="ad-sr">Change creator photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadPhoto} />
            </label>
          </div>
          <div className="cp-top-fields">
            <label className="ad-field">Creator name <b className="req">*</b><input {...field('name')} /></label>
            <label className="ad-field">Heading <b className="req">*</b><input {...field('headline')} /></label>
            <label className="ad-field cp-span">Short bio <b className="req">*</b><textarea rows={3} maxLength={500} {...field('bio')} /></label>
          </div>
        </div>

        <div className="ad-two">
          <label className="ad-field">Instagram profile link<input {...field('instagram_url')} /></label>
          <label className="ad-field">YouTube channel link<input {...field('youtube_url')} /></label>
        </div>
        <label className="ad-field">Contact email (shown in the footer)<input type="email" {...field('email')} /></label>
        <div className="ad-three">
          <label className="ad-field">Instagram followers (e.g. 5K+)<input {...field('stat_instagram')} /></label>
          <label className="ad-field">YouTube subscribers (e.g. 12K+)<input {...field('stat_youtube')} /></label>
          <label className="ad-field">Reel views (e.g. 2M+)<input {...field('stat_views')} /></label>
        </div>
        <p className="ad-hint">Empty fields use the default shown in grey. Leave YouTube subscribers empty to show “Watch on YouTube”. Square photos work best.</p>

        <div className="ad-actions">
          <button className="ad-btn ad-primary" type="submit" disabled={busy}><AIcon name="save" size={18} />Save Creator &amp; Footer</button>
          {msg.text && <span className={`ad-inline ${msg.kind}`} role="status">{msg.text}</span>}
        </div>
      </form>
    </div>
  );
}

/* ---------------- Email sign-ups card (paged, searchable, CSV export) ---------------- */
export function SignupsCard({ api, call, token, notify, open, onToggle, onCount, reloadKey, onChanged, id = 'ad-signups' }) {
  const [page, setPage] = useState(1);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const query = useDebounced(text.trim(), 300);
  useEffect(() => setPage(1), [query]);
  const list = usePaged(call, '/api/admin/subscribers', { page, page_size: 10, q: query }, reloadKey);
  useEffect(() => { if (!query && !list.loading && !list.error) onCount?.(list.total); }, [list.total, list.loading, list.error, query]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!list.loading && !list.error && list.items.length === 0 && page > 1) setPage(page - 1); }, [list.loading, list.error, list.items.length, page]);

  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.email} from the sign-up list?`)) return;
    try {
      const { ok, status, data } = await call(`/api/admin/subscribers/${row.id}`, { method: 'DELETE' });
      if (!ok) throw Error(detailOf(data, status));
      notify('ok', `${row.email} was removed.`); list.reload(); onChanged?.();
    } catch (error) { if (error.message !== 'expired') notify('error', `Could not remove ${row.email}: ${error.message}`); }
  };
  const exportCsv = async () => {
    setBusy(true);
    try {
      await downloadFile(api, `/api/admin/subscribers/export.csv${query ? `?q=${encodeURIComponent(query)}` : ''}`, token, 'staycation-signups.csv');
      notify('ok', `Downloaded ${query ? 'the matching' : 'all'} sign-ups as a CSV file. Open it in Excel or Google Sheets.`);
    } catch (error) { if (error.message !== 'expired') notify('error', `Could not download the sign-ups: ${error.message}`); }
    setBusy(false);
  };

  return (
    <div className={`ad-card ad-collapse${open ? ' open' : ''}`} id={id}>
      <button type="button" className="ad-collapse-head" onClick={onToggle} aria-expanded={open} aria-controls={`${id}-body`}>
        <span className="ad-tile"><AIcon name="mail" size={24} /></span>
        <span className="ad-collapse-title">
          <b>Email Signup{!query && !list.error ? <span className="ad-count">{list.total.toLocaleString('en-IN')}</span> : null}</b>
          <small>People who joined “Stay in the Loop” in the footer.</small>
        </span>
        <AIcon name={open ? 'down' : 'right'} size={20} className="ad-chev" />
      </button>

      {open && (
        <div className="ad-collapse-body" id={`${id}-body`}>
          <div className="ad-sub-tools">
            <label className="ad-search small">
              <AIcon name="search" size={17} /><span className="ad-sr">Search sign-ups</span>
              <input type="search" placeholder="Search emails…" value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <button type="button" className="ad-btn ad-ghost" onClick={exportCsv} disabled={busy || list.total === 0}><AIcon name="download" size={17} />{busy ? 'Preparing…' : 'Export CSV'}</button>
          </div>
          {list.error && <p className="ad-inline error" role="alert">{list.error} <button type="button" className="ad-link" onClick={list.reload}>Try again</button></p>}
          {!list.error && !list.loading && list.total === 0 && <p className="ad-empty">{query ? 'No emails match your search.' : 'No sign-ups yet.'}</p>}
          <ul className={`ad-rows${list.loading ? ' loading' : ''}`} aria-busy={list.loading}>
            {list.items.map((row) => (
              <li className="ad-row ad-row-sub" key={row.id}>
                <span className="ad-row-main"><b>{row.email}</b><small>{new Date(row.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span>
                <button type="button" className="ad-btn ad-danger ad-sm" onClick={() => remove(row)}>Remove</button>
              </li>
            ))}
          </ul>
          <Pager page={page} pages={list.pages} total={list.total} onPage={setPage} noun="email" />
        </div>
      )}
    </div>
  );
}

export default CreatorCard;
