import { useEffect, useRef, useState } from 'react';
import { cld } from '../../lib/cloudinary.js';
import AIcon, { PlayDot } from './admin-icons.jsx';
import { detailOf, uploadWithProgress, usePaged } from './admin-api.js';

// First frame of a Cloudinary video as a small JPG (same idea as the public reels).
const reelThumb = (url) => {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) return undefined;
  return url.replace('/video/upload/', '/video/upload/so_0,w_160,q_auto/').replace(/\.(mp4|mov|webm)(\?.*)?$/i, '.jpg');
};

// 34 -> "0:34", 0 -> "" (unknown, e.g. older uploads)
const clock = (s) => (s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');
// 12400 -> "12.4K", 2300000 -> "2.3M"
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K` : String(n));

export function Pager({ page, pages, total, onPage, noun, plural }) {
  if (total === 0) return null;
  return (
    <div className="ad-pager">
      <span>{total.toLocaleString('en-IN')} {total === 1 ? noun : (plural || `${noun}s`)}{pages > 1 ? ` · page ${page} of ${pages.toLocaleString('en-IN')}` : ''}</span>
      {pages > 1 && (
        <span className="ad-pager-btns">
          <button type="button" className="ad-btn ad-ghost ad-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
          <button type="button" className="ad-btn ad-ghost ad-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
        </span>
      )}
    </div>
  );
}

// Moves back a page when the last row of a page was deleted.
function useBackWhenEmpty(list, page, setPage) {
  useEffect(() => { if (!list.loading && !list.error && list.items.length === 0 && page > 1) setPage(page - 1); }, [list.loading, list.error, list.items.length, page, setPage]);
}

const FILTERS = [['all', 'All'], ['published', 'Published'], ['draft', 'Drafts']];
function Filters({ value, onChange }) {
  return (
    <div className="ad-filters" role="group" aria-label="Filter by status">
      {FILTERS.map(([key, label]) => <button key={key} type="button" className={value === key ? 'on' : ''} aria-pressed={value === key} onClick={() => onChange(key)}>{label}</button>)}
    </div>
  );
}

/* ---------------- Properties list ---------------- */
export function PropertiesCard({ call, notify, query, reloadKey, editingId, onEdit, onDeleted, onChanged }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(0);
  useEffect(() => setPage(1), [query]);
  const list = usePaged(call, '/api/admin/properties', { page, page_size: 8, q: query, status }, reloadKey);
  useBackWhenEmpty(list, page, setPage);

  const open = async (row) => {
    setBusy(row.id);
    try {
      const { ok, status: code, data } = await call(`/api/admin/properties/${row.id}`);
      if (!ok) throw Error(detailOf(data, code));
      onEdit(data);
    } catch (error) { if (error.message !== 'expired') notify('error', `Could not open “${row.name}”: ${error.message}`); }
    setBusy(0);
  };
  const toggle = async (row) => {
    setBusy(row.id);
    try {
      const { ok, status: code, data } = await call(`/api/admin/properties/${row.id}`, { method: 'PATCH', body: { published: !row.published } });
      if (!ok) throw Error(detailOf(data, code));
      notify('ok', data.published ? `“${row.name}” is now live on the website.` : `“${row.name}” is hidden from the website (draft).`);
      list.reload(); onChanged();
    } catch (error) { if (error.message !== 'expired') notify('error', `Could not change “${row.name}”: ${error.message}`); }
    setBusy(0);
  };
  const remove = async (row) => {
    if (!window.confirm(`Delete “${row.name}”? This cannot be undone.`)) return;
    setBusy(row.id);
    try {
      const { ok, status: code, data } = await call(`/api/admin/properties/${row.id}`, { method: 'DELETE' });
      if (!ok) throw Error(detailOf(data, code));
      onDeleted(row.id); notify('ok', `“${row.name}” was deleted.`);
      list.reload(); onChanged();
    } catch (error) { if (error.message !== 'expired') notify('error', `Could not delete “${row.name}”: ${error.message}`); }
    setBusy(0);
  };

  return (
    <div className="ad-card" id="ad-plist">
      <div className="ad-card-head">
        <span className="ad-tile"><AIcon name="home" size={24} /></span>
        <div><h2>Properties</h2><p>Manage your listed properties.</p></div>
        <span className="ad-head-note">Edit and delete existing properties.</span>
      </div>
      <Filters value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
      {list.error && <p className="ad-inline error" role="alert">{list.error} <button type="button" className="ad-link" onClick={list.reload}>Try again</button></p>}
      {!list.error && !list.loading && list.items.length === 0 && <p className="ad-empty">{query || status !== 'all' ? 'No properties match.' : 'No properties yet. Add your first one on the left.'}</p>}
      <ul className={`ad-rows${list.loading ? ' loading' : ''}`} aria-busy={list.loading}>
        {list.items.map((row) => (
          <li className={`ad-row ad-row-prop${editingId === row.id ? ' editing' : ''}`} key={row.id}>
            <span className="ad-thumb">{row.image_url ? <img src={cld(row.image_url, 200)} alt="" loading="lazy" decoding="async" /> : <AIcon name="image" size={22} />}</span>
            <span className="ad-row-main">
              <b>{row.name}</b>
              <small><AIcon name="pin" size={14} />{row.location}{row.photo_count > 1 ? ` · ${row.photo_count} photos` : ''}</small>
            </span>
            <button type="button" className={`ad-chip ad-chip-btn ${row.published ? 'live' : 'draft'}`} disabled={busy === row.id} onClick={() => toggle(row)}
              title={row.published ? 'Click to hide this property from the website' : 'Click to publish this property'}>
              <i />{row.published ? 'Published' : 'Draft'}
            </button>
            <span className="ad-row-btns">
              <button type="button" className="ad-btn ad-ghost ad-sm" disabled={busy === row.id} onClick={() => open(row)}><AIcon name="pencil" size={15} />Edit</button>
              <button type="button" className="ad-btn ad-danger ad-sm" disabled={busy === row.id} onClick={() => remove(row)}><AIcon name="trash" size={15} />Delete</button>
            </span>
          </li>
        ))}
      </ul>
      <Pager page={page} pages={list.pages} total={list.total} onPage={setPage} noun="property" plural="properties" />
    </div>
  );
}

/* ---------------- Reels ---------------- */
export function ReelsCard({ call, notify, token, api, query, reloadKey, onChanged }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(0);
  const [progress, setProgress] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => setPage(1), [query]);
  const list = usePaged(call, '/api/admin/reels', { page, page_size: 6, q: query, status }, reloadKey);
  useBackWhenEmpty(list, page, setPage);

  const upload = async (event) => {
    const input = event.target; const file = input.files[0]; input.value = '';
    if (!file) return;
    if (!/^video\/(mp4|quicktime|webm)$/.test(file.type)) { notify('error', `${file.name}: use an MP4, MOV or WebM video.`); return; }
    if (file.size > 100 * 1024 * 1024) { notify('error', `${file.name} is larger than 100 MB. Compress it and try again.`); return; }
    const form = new FormData(); form.append('file', file);
    setProgress(0);
    try {
      const { ok, status: code, data } = await uploadWithProgress(`${api}/api/admin/upload/reel`, token, form, setProgress);
      if (code === 401) throw Error('Your session expired. Sign in again, then upload the reel again.');
      if (!ok) throw Error(detailOf(data, code));
      notify('ok', 'Reel uploaded as a draft. Press Publish to show it on the website.');
      setStatus('all'); setPage(1); list.reload(); onChanged();
    } catch (error) { notify('error', error.message || 'Reel upload failed'); }
    setProgress(null);
  };
  const toggle = async (reel) => {
    setBusy(reel.id);
    try {
      const { ok, status: code, data } = await call(`/api/admin/reels/${reel.id}`, { method: 'PATCH', body: { published: !reel.published } });
      if (!ok) throw Error(detailOf(data, code));
      notify('ok', data.published ? `“${data.title}” is now published and live on the website.` : `“${data.title}” moved back to draft.`);
      list.reload(); onChanged();
    } catch (error) { if (error.message !== 'expired') notify('error', error.message); }
    setBusy(0);
  };
  const remove = async (reel) => {
    if (!window.confirm(`Delete the reel “${reel.title}”? This cannot be undone.`)) return;
    setBusy(reel.id);
    try {
      const { ok, status: code, data } = await call(`/api/admin/reels/${reel.id}`, { method: 'DELETE' });
      if (!ok) throw Error(detailOf(data, code));
      notify('ok', `“${reel.title}” was deleted.`); list.reload(); onChanged();
    } catch (error) { if (error.message !== 'expired') notify('error', `Could not delete the reel: ${error.message}`); }
    setBusy(0);
  };

  return (
    <div className="ad-card" id="ad-reels">
      <div className="ad-card-head">
        <span className="ad-tile"><AIcon name="reels" size={25} /></span>
        <div><h2>Reels</h2><p>Upload and manage travel reels.</p></div>
        <button type="button" className="ad-btn ad-primary ad-head-btn" disabled={progress !== null} onClick={() => fileRef.current?.click()}><AIcon name="upload" size={18} />{progress !== null ? 'Uploading…' : 'Upload Reel'}</button>
        <input ref={fileRef} type="file" hidden accept="video/mp4,video/quicktime,video/webm" onChange={upload} aria-label="Upload reel video" />
      </div>
      {progress !== null
        ? (
          <div className="ad-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} /><b>{progress < 100 ? `Uploading ${progress}%… keep this page open` : 'Processing the video…'}</b>
          </div>
        )
        : <p className="ad-hint">Upload a video (MP4, MOV or WebM, up to 100 MB) as a draft, then publish it to show it in the public reels gallery.</p>}
      <Filters value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
      {list.error && <p className="ad-inline error" role="alert">{list.error} <button type="button" className="ad-link" onClick={list.reload}>Try again</button></p>}
      {!list.error && !list.loading && list.items.length === 0 && <p className="ad-empty">{query || status !== 'all' ? 'No reels match.' : 'No reels uploaded yet.'}</p>}
      <ul className={`ad-rows${list.loading ? ' loading' : ''}`} aria-busy={list.loading}>
        {list.items.map((reel) => (
          <li className="ad-row ad-row-reel" key={reel.id}>
            <span className="ad-thumb reel">
              {reelThumb(reel.video_url) ? <img src={reelThumb(reel.video_url)} alt="" loading="lazy" decoding="async" /> : <AIcon name="reels" size={22} />}
              <i className="ad-play"><PlayDot /></i>
            </span>
            <span className="ad-row-main"><b>{reel.title}</b>{clock(reel.duration) && <small>Duration: {clock(reel.duration)}</small>}</span>
            <span className={`ad-chip ${reel.published ? 'live' : 'draft'}`}><i />{reel.published ? 'Published' : 'Unpublished'}</span>
            {typeof reel.views === 'number' && !/instagram\.com\//i.test(reel.video_url || '') && <span className="ad-views" title={`${reel.views.toLocaleString('en-IN')} views on the website`}><AIcon name="eye" size={17} />{compact(reel.views)}</span>}
            <span className="ad-row-btns">
              <button type="button" className={`ad-btn ad-sm ${reel.published ? 'ad-ghost' : 'ad-soft'}`} disabled={busy === reel.id} onClick={() => toggle(reel)}>{reel.published ? 'Unpublish' : 'Publish'}</button>
              <button type="button" className="ad-btn ad-danger ad-sm" disabled={busy === reel.id} onClick={() => remove(reel)}><AIcon name="trash" size={15} />Delete</button>
            </span>
          </li>
        ))}
      </ul>
      <Pager page={page} pages={list.pages} total={list.total} onPage={setPage} noun="reel" />
    </div>
  );
}
