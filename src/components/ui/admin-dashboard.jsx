import { useEffect, useState } from 'react';
import AIcon from './admin-icons.jsx';
import { detailOf, downloadFile } from './admin-api.js';

const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Stat({ icon, tone, title, value, lines, onOpen }) {
  const body = (
    <>
      <span className={`ad-tile ${tone || ''}`}><AIcon name={icon} size={24} /></span>
      <div>
        <small>{title}</small>
        <b>{value.toLocaleString('en-IN')}</b>
        {lines.map((line) => <span key={line}>{line}</span>)}
      </div>
    </>
  );
  return onOpen
    ? <button type="button" className="ad-card ad-stat ad-stat-btn" onClick={onOpen} title={`Open ${title}`}>{body}</button>
    : <div className="ad-card ad-stat">{body}</div>;
}

// The 14-day sign-up chart is plain HTML bars (nothing to download, works on a phone).
function Bars({ series, one = 'sign-up', many = 'sign-ups' }) {
  const max = Math.max(1, ...series.map((d) => d.count));
  return (
    <div className="ad-bars" role="img" aria-label={`${many[0].toUpperCase()}${many.slice(1)} per day for the last 14 days. Highest day: ${max}.`}>
      {series.map((d) => (
        <span key={d.date} className="ad-bar" title={`${day(d.date)}: ${d.count} ${d.count === 1 ? one : many}`}>
          <i style={{ height: `${Math.max(d.count ? 8 : 3, (d.count / max) * 100)}%` }} className={d.count ? '' : 'zero'} />
          <small>{new Date(`${d.date}T00:00:00`).getDate()}</small>
        </span>
      ))}
    </div>
  );
}

// WhatsApp enquiries: how many visitors tapped WhatsApp on a property, per day and per property.
function EnquiriesCard({ data, onOpenProperties }) {
  const topWeek = Math.max(1, ...data.properties.map((p) => p.week));
  return (
    <div className="ad-card ad-dash-wide">
      <div className="ad-card-head">
        <span className="ad-tile green"><AIcon name="whatsapp" size={24} /></span>
        <div><h2>WhatsApp enquiries</h2><p>Visitors who tapped WhatsApp on a property.</p></div>
      </div>
      <div className="ad-enq-sums">
        <div><b>{data.today.toLocaleString('en-IN')}</b><small>Today</small></div>
        <div><b>{data.week.toLocaleString('en-IN')}</b><small>Last 7 days</small></div>
        <div><b>{data.total.toLocaleString('en-IN')}</b><small>All time</small></div>
      </div>
      {data.total === 0
        ? <p className="ad-empty">No enquiries yet. Each time a visitor taps WhatsApp on a property, it is counted here.</p>
        : (
          <div className="ad-enq-cols">
            <div>
              <h3 className="ad-enq-h">Last 14 days</h3>
              <Bars series={data.by_day} one="enquiry" many="enquiries" />
            </div>
            <div>
              <h3 className="ad-enq-h">By property</h3>
              <ol className="ad-enq-list">
                {data.properties.map((p, index) => (
                  <li className="ad-enq-row" key={p.id}>
                    <span className="ad-enq-rank">{index + 1}</span>
                    <span className="ad-enq-main">
                      <b>{p.name}</b>
                      <i className="ad-enq-track"><em style={{ width: `${p.week ? Math.max(5, (p.week / topWeek) * 100) : 0}%` }} /></i>
                    </span>
                    <span className="ad-enq-num"><b>{p.week.toLocaleString('en-IN')}</b><small>this week</small></span>
                    <span className="ad-enq-num"><b>{p.total.toLocaleString('en-IN')}</b><small>total</small></span>
                  </li>
                ))}
              </ol>
              {onOpenProperties && <button type="button" className="ad-link" onClick={onOpenProperties}>Open properties</button>}
            </div>
          </div>
        )}
      <p className="ad-hint ad-enq-note">One visitor counts once per property every 10 minutes. Days follow UTC, like the sign-ups chart.</p>
    </div>
  );
}

function Check({ ok, label, bad, fix }) {
  return (
    <li className={ok ? 'ok' : 'bad'}>
      <AIcon name={ok ? 'check' : 'alert'} size={18} />
      <span><b>{ok ? label : (bad || label)}</b>{!ok && fix ? <small>{fix}</small> : null}</span>
    </li>
  );
}

export function AttentionBanner({ status, onOpenSettings }) {
  const warnings = status?.warnings || [];
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(false), [warnings.join('|')]);
  if (!warnings.length || hidden) return null;
  return (
    <div className="ad-notice warn" role="status">
      <AIcon name="shield" size={20} />
      <span><b>{warnings.length === 1 ? '1 thing needs your attention' : `${warnings.length} things need your attention`}:</b> {warnings[0]}{warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}</span>
      <button type="button" className="ad-link" onClick={onOpenSettings}>Open Settings</button>
      <button type="button" onClick={() => setHidden(true)} aria-label="Hide this message"><AIcon name="close" size={16} /></button>
    </div>
  );
}

export function DashboardView({ meta, onRefresh, onOpenSettings, onOpenSignups, onOpenProperties, onOpenReels }) {
  const { stats, status, error } = meta;
  if (error) {
    return (
      <div className="ad-card ad-dash-empty">
        <span className="ad-tile"><AIcon name="alert" size={24} /></span>
        <div>
          <h2>Dashboard is not available</h2>
          <p>{error}</p>
          <button type="button" className="ad-btn ad-primary" onClick={onRefresh}><AIcon name="refresh" size={17} />Try again</button>
        </div>
      </div>
    );
  }
  if (!stats) return <p className="ad-empty">Loading the dashboard…</p>;
  const subs = stats.subscribers;
  return (
    <div className="ad-dash">
      <div className="ad-stats">
        <Stat icon="home" title="Properties" onOpen={onOpenProperties} value={stats.properties.total} lines={[`${stats.properties.published} published`, `${stats.properties.draft} draft${stats.properties.draft === 1 ? '' : 's'}`]} />
        <Stat icon="reels" title="Reels" onOpen={onOpenReels} value={stats.reels.total} lines={[`${stats.reels.published} published`, `${stats.reels.draft} draft${stats.reels.draft === 1 ? '' : 's'}`, ...(typeof stats.reels.views === 'number' ? [`${stats.reels.views.toLocaleString('en-IN')} views on the website`] : [])]} />
        <Stat icon="mail" tone="green" title="Email sign-ups" onOpen={onOpenSignups} value={subs.total} lines={[`${subs.today} today`, `${subs.week} in the last 7 days`]} />
      </div>

      <div className="ad-dash-grid">
        {stats.enquiries && <EnquiriesCard data={stats.enquiries} onOpenProperties={onOpenProperties} />}

        <div className="ad-card">
          <div className="ad-card-head">
            <span className="ad-tile"><AIcon name="pulse" size={24} /></span>
            <div><h2>Sign-ups, last 14 days</h2><p>New emails from the footer form.</p></div>
          </div>
          <Bars series={stats.signups_by_day} />
        </div>

        <div className="ad-card">
          <div className="ad-card-head">
            <span className="ad-tile"><AIcon name="mail" size={24} /></span>
            <div><h2>Latest sign-ups</h2><p>The five newest emails.</p></div>
          </div>
          {stats.recent_subscribers.length === 0 && <p className="ad-empty">No sign-ups yet.</p>}
          <ul className="ad-rows">
            {stats.recent_subscribers.map((s) => <li className="ad-row ad-row-sub" key={s.id}><span className="ad-row-main"><b>{s.email}</b><small>{when(s.created_at)}</small></span></li>)}
          </ul>
          {subs.total > 5 && <button type="button" className="ad-link" onClick={onOpenSignups}>See all {subs.total.toLocaleString('en-IN')} sign-ups</button>}
        </div>

        <div className="ad-card ad-dash-wide">
          <div className="ad-card-head">
            <span className="ad-tile"><AIcon name="shield" size={24} /></span>
            <div><h2>System check</h2><p>Everything the website needs to keep saving data safely.</p></div>
            <button type="button" className="ad-btn ad-ghost ad-sm ad-head-btn" onClick={onRefresh}><AIcon name="refresh" size={15} />Refresh</button>
          </div>
          {status
            ? (
              <ul className="ad-checks">
                <Check ok={status.database.ok} label={`Database connected (${status.database.kind === 'postgresql' ? 'PostgreSQL' : status.database.kind})`} fix="The database does not answer. Check DATABASE_URL in backend/.env and restart the backend." />
                <Check ok={status.cloudinary} label="Photo and reel uploads (Cloudinary) are working" bad="Photo and reel uploads are not set up" fix="Add the three CLOUDINARY_* values to backend/.env and restart the backend." />
                <Check ok={status.whatsapp_set} label="WhatsApp number saved" bad="WhatsApp number is not saved yet" fix="Save your number in the WhatsApp Contact card." />
                <Check ok={status.secure_password} label="Admin password is strong" bad="Admin password is weak or still the default" fix="Change it in Settings now." />
                <Check ok={status.secure_secret} label="Login secret (JWT_SECRET) is strong" bad="Login secret (JWT_SECRET) is weak or missing" fix="Set a long random JWT_SECRET in backend/.env and restart the backend." />
                <Check ok={status.errors_24h === 0} label={status.errors_24h === 0 ? 'No server errors in the last 24 hours' : `${status.errors_24h} server error${status.errors_24h === 1 ? '' : 's'} in the last 24 hours`} fix="See Settings > Recent errors." />
              </ul>
            )
            : <p className="ad-empty">Status is not available yet.</p>}
          {status && status.warnings.length > 0 && <button type="button" className="ad-link" onClick={onOpenSettings}>Open Settings</button>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Settings: password, devices, backup, errors ---------------- */
export function SettingsCard({ api, call, token, notify, onNewToken, onSignOutEverywhere, onSignOut, reloadKey, onChanged }) {
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [pwMsg, setPwMsg] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState(null);
  const [showErrors, setShowErrors] = useState(false);

  const loadErrors = async () => {
    try {
      const { ok, status, data } = await call('/api/admin/errors');
      if (!ok) throw Error(detailOf(data, status));
      setErrors(data);
    } catch (error) { if (error.message !== 'expired') setErrors({ items: [], total: 0, failed: error.message }); }
  };
  useEffect(() => { if (showErrors) loadErrors(); }, [showErrors, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const changePassword = async (event) => {
    event.preventDefault();
    if (pw.next.length < 10) { setPwMsg({ kind: 'error', text: 'The new password must be at least 10 characters.' }); return; }
    if (pw.next !== pw.again) { setPwMsg({ kind: 'error', text: 'The two new passwords do not match.' }); return; }
    setBusy('pw'); setPwMsg({ kind: 'info', text: 'Saving…' });
    try {
      const { ok, status, data } = await call('/api/admin/password', { method: 'POST', body: { current_password: pw.current, new_password: pw.next } });
      if (!ok) throw Error(detailOf(data, status));
      onNewToken(data.access_token); setPw({ current: '', next: '', again: '' });
      setPwMsg({ kind: 'ok', text: 'Password changed. Other devices were signed out.' }); onChanged();
    } catch (error) { if (error.message !== 'expired') setPwMsg({ kind: 'error', text: error.message }); }
    setBusy('');
  };
  const everywhere = async () => {
    if (!window.confirm('Sign out of the admin panel on every device, including this one?')) return;
    try {
      const { ok, status, data } = await call('/api/admin/logout-all', { method: 'POST' });
      if (!ok) throw Error(detailOf(data, status));
      onSignOutEverywhere();
    } catch (error) { if (error.message !== 'expired') notify('error', error.message); }
  };
  const backup = async () => {
    setBusy('backup');
    try {
      await downloadFile(api, '/api/admin/backup', token, 'staycation-backup.json');
      notify('ok', 'Backup downloaded: properties, reels, sign-ups and settings in one JSON file. Keep it somewhere safe.');
    } catch (error) { if (error.message !== 'expired') notify('error', `Backup failed: ${error.message}`); }
    setBusy('');
  };
  const clearErrors = async () => {
    try { await call('/api/admin/errors', { method: 'DELETE' }); setErrors({ items: [], total: 0 }); onChanged(); }
    catch (error) { if (error.message !== 'expired') notify('error', error.message); }
  };

  return (
    <div className="ad-card ad-settings" id="ad-settings">
      <div className="ad-card-head">
        <span className="ad-tile"><AIcon name="gear" size={24} /></span>
        <div><h2>Settings</h2><p>Password, security and backups. Only you can sign in here.</p></div>
      </div>

      <form className="ad-set-block" onSubmit={changePassword}>
        <h3><AIcon name="key" size={18} />Change password</h3>
        <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
        <div className="ad-three">
          <label className="ad-field">Current password<input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></label>
          <label className="ad-field">New password (10+ characters)<input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></label>
          <label className="ad-field">New password again<input type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} required /></label>
        </div>
        <div className="ad-actions">
          <button className="ad-btn ad-primary" type="submit" disabled={busy === 'pw'}><AIcon name="save" size={18} />Save password</button>
          {pwMsg.text && <span className={`ad-inline ${pwMsg.kind}`} role="status">{pwMsg.text}</span>}
        </div>
      </form>

      <div className="ad-set-block">
        <h3><AIcon name="download" size={18} />Backup</h3>
        <p className="ad-hint">Downloads everything saved on the website (properties with photo links, reels, all email sign-ups and settings) as one file. Do this now and then.</p>
        <div className="ad-actions"><button type="button" className="ad-btn ad-ghost" onClick={backup} disabled={busy === 'backup'}><AIcon name="download" size={17} />{busy === 'backup' ? 'Preparing…' : 'Download full backup'}</button></div>
      </div>

      <div className="ad-set-block">
        <h3><AIcon name="alert" size={18} />Recent errors</h3>
        <p className="ad-hint">If something on the website or here ever fails, the reason is written here in plain words.</p>
        <div className="ad-actions">
          <button type="button" className="ad-btn ad-ghost" onClick={() => setShowErrors(!showErrors)}>{showErrors ? 'Hide errors' : 'Show recent errors'}</button>
          {showErrors && errors && errors.total > 0 && <button type="button" className="ad-btn ad-ghost" onClick={clearErrors}>Clear list</button>}
        </div>
        {showErrors && errors && (
          errors.failed
            ? <p className="ad-inline error" role="alert">{errors.failed}</p>
            : errors.items.length === 0
              ? <p className="ad-inline ok">No errors recorded.</p>
              : (
                <ul className="ad-errors">
                  {errors.items.map((e) => <li key={e.id}><b>{e.method} {e.path}</b><span>{e.message}</span><small>{when(e.created_at)}</small></li>)}
                </ul>
              )
        )}
      </div>

      <div className="ad-actions">
        <a className="ad-btn ad-ghost" href="/" target="_blank" rel="noreferrer"><AIcon name="external" size={17} />View website</a>
        <button type="button" className="ad-btn ad-ghost" onClick={everywhere}><AIcon name="shield" size={17} />Sign out everywhere</button>
        <button type="button" className="ad-btn ad-danger" onClick={onSignOut}><AIcon name="logout" size={17} />Sign out</button>
      </div>
    </div>
  );
}
