import { useCallback, useEffect, useRef, useState } from 'react';

export const TOKEN_KEY = 'staycation_token';

// Turns whatever the server sent back into one readable sentence.
export const detailOf = (data, status) => {
  if (data && typeof data.detail === 'string') return data.detail;
  if (data && Array.isArray(data.detail)) return data.detail.map((d) => d.msg).join(', ');
  if (status === 404) return 'Not found. If you just updated the backend, restart it and try again.';
  if (status === 413) return 'That file is too large.';
  if (status >= 500) return `The server had a problem (error ${status}). Open Settings > Recent errors to see what happened.`;
  return `Request failed (error ${status})`;
};

export const NETWORK_ERROR = 'Cannot reach the backend. Check that it is running and your internet is working, then try again.';

// The newer backend returns { items, total, pages }. An older one returns a plain list, which is wrapped to look the same.
export const asPage = (data) => {
  if (Array.isArray(data)) return { items: data, total: data.length, page: 1, page_size: data.length || 1, pages: 1 };
  if (data && Array.isArray(data.items)) return data;
  return { items: [], total: 0, page: 1, page_size: 1, pages: 1 };
};

export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

// One helper for every API call: adds the sign-in token, parses JSON, and ends the session when the token has expired.
// The token lives in a ref, so renewing it never makes lists reload.
export function useAdminCall(api, tokenRef, onExpired) {
  return useCallback(async (path, { body, form, ...options } = {}) => {
    const headers = tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(`${api}${path}`, { ...options, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    } catch {
      throw Error(NETWORK_ERROR);
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && tokenRef.current) { onExpired(); throw Error('expired'); }
    return { ok: response.ok, status: response.status, data };
  }, [api, tokenRef, onExpired]);
}

// Upload with a real progress percentage (fetch cannot report upload progress).
export function uploadWithProgress(url, token, form, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(Error(NETWORK_ERROR));
    request.ontimeout = () => reject(Error('The upload took too long. Try a smaller video or a faster connection.'));
    request.onload = () => {
      let data = {};
      try { data = JSON.parse(request.responseText); } catch { /* keep empty */ }
      resolve({ ok: request.status >= 200 && request.status < 300, status: request.status, data });
    };
    request.timeout = 15 * 60 * 1000;
    request.send(form);
  });
}

// Saves a file the server streams (CSV export, backup). Handled as a blob so the sign-in header can be sent.
export async function downloadFile(api, path, token, fallbackName) {
  let response;
  try { response = await fetch(`${api}${path}`, { headers: { Authorization: `Bearer ${token}` } }); } catch { throw Error(NETWORK_ERROR); }
  if (response.status === 401) throw Error('expired');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Error(detailOf(data, response.status));
  }
  const blob = await response.blob();
  const match = /filename="?([^";]+)"?/i.exec(response.headers.get('Content-Disposition') || '');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = match ? match[1] : fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

// A page of a server-side list. Stale answers are ignored, so typing fast in the search box never shows old results.
export function usePaged(call, path, params, reloadKey) {
  const [state, setState] = useState({ items: [], total: 0, pages: 1, loading: true, error: '' });
  const counter = useRef(0);
  const key = JSON.stringify(params);
  const load = useCallback(async () => {
    const mine = ++counter.current;
    setState((value) => ({ ...value, loading: true, error: '' }));
    try {
      const { ok, status, data } = await call(`${path}?${new URLSearchParams(JSON.parse(key)).toString()}`);
      if (mine !== counter.current) return;
      if (!ok) throw Error(detailOf(data, status));
      const page = asPage(data);
      setState({ items: page.items, total: page.total, pages: page.pages, loading: false, error: '' });
    } catch (error) {
      if (mine !== counter.current || error.message === 'expired') return;
      setState((value) => ({ ...value, loading: false, error: error.message }));
    }
  }, [call, path, key]);
  useEffect(() => { load(); }, [load, reloadKey]);
  return { ...state, reload: load };
}
