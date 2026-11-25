import { useRef, useState } from 'react';
import { cld } from '../../lib/cloudinary.js';
import './property-images-field.css';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_MB = 10;
const MAX_PHOTOS = 30;

// Admin field: pick many photos at once. The first photo is the cover shown on the property card.
// `update` receives a function: update((list) => newList).
export default function PropertyImagesField({ images, update, token, api, onUnauthorized }) {
  const inputRef = useRef(null);
  const fresh = useRef(new Set()); // photos uploaded in this session but not saved yet
  const [progress, setProgress] = useState(null);
  const [problems, setProblems] = useState([]);

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const issues = [];
    const room = MAX_PHOTOS - images.length;
    const queue = [];
    files.forEach((file) => {
      if (!TYPES.includes(file.type)) issues.push(`${file.name}: use JPG, PNG, WebP or AVIF (iPhone HEIC is not supported).`);
      else if (file.size > MAX_MB * 1024 * 1024) issues.push(`${file.name}: larger than ${MAX_MB} MB.`);
      else if (queue.length >= room) issues.push(`${file.name}: limit of ${MAX_PHOTOS} photos reached.`);
      else queue.push(file);
    });
    setProblems(issues);
    if (!queue.length) return;

    let done = 0;
    setProgress({ done, total: queue.length });
    for (const file of queue) {
      try {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch(`${api}/api/admin/upload/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body,
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setProgress(null);
          onUnauthorized?.();
          return;
        }
        if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `error ${response.status}`);
        fresh.current.add(data.public_id);
        update((list) => [...list, { url: data.url, public_id: data.public_id }]);
      } catch (error) {
        issues.push(`${file.name}: ${error.message || 'upload failed'}`);
        setProblems([...issues]);
      }
      done += 1;
      setProgress({ done, total: queue.length });
    }
    setProgress(null);
  };

  const move = (i, step) => update((list) => {
    const j = i + step;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const makeCover = (i) => update((list) => [list[i], ...list.filter((_, k) => k !== i)]);
  const remove = (i) => {
    const image = images[i];
    update((list) => list.filter((_, k) => k !== i));
    // A photo that was never saved can be deleted from Cloudinary right away.
    if (image?.public_id && fresh.current.has(image.public_id)) {
      fresh.current.delete(image.public_id);
      fetch(`${api}/api/admin/upload/${encodeURI(image.public_id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  };

  const uploading = progress !== null;

  return (
    <div className="pif">
      <div className="pif-head">
        <span className="pif-title">Property photos</span>
        <button type="button" className="pif-add" onClick={() => inputRef.current?.click()} disabled={uploading || images.length >= MAX_PHOTOS}>
          {uploading ? `Uploading ${progress.done + 1} of ${progress.total}…` : '+ Add photos'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={TYPES.join(',')}
          hidden
          onChange={(event) => {
            const files = event.target.files;
            addFiles(files);
            event.target.value = '';
          }}
        />
      </div>
      <p className="pif-hint">
        {images.length
          ? `${images.length} photo${images.length === 1 ? '' : 's'}. The first photo is the cover shown on the card; visitors can open all of them.`
          : 'Select several photos at once (JPG, PNG, WebP). The first one becomes the cover.'}
      </p>

      {images.length > 0 && (
        <div className="pif-grid">
          {images.map((image, i) => (
            <div className={`pif-item${i === 0 ? ' cover' : ''}`} key={image.public_id || image.url}>
              <img src={cld(image.url, 320)} alt={`Photo ${i + 1}`} />
              {i === 0 && <span className="pif-badge">COVER</span>}
              <button type="button" className="pif-remove" onClick={() => remove(i)} aria-label="Remove photo" title="Remove photo">×</button>
              <div className="pif-actions">
                <button type="button" className="step" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" title="Move earlier">←</button>
                <button type="button" className="step" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Move later" title="Move later">→</button>
                {i > 0 ? (
                  <button type="button" className="cover-btn" onClick={() => makeCover(i)} title="Use as cover photo">Set cover</button>
                ) : (
                  <span className="pif-cover-note">Cover photo</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {problems.length > 0 && (
        <ul className="pif-problems" role="alert">
          {problems.map((text) => <li key={text}>{text}</li>)}
        </ul>
      )}
    </div>
  );
}
