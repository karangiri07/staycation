// The free server falls asleep when nobody has visited for a while and needs a minute or two to wake up.
// getJson keeps asking until the server answers, so visitors never see made-up demo content while it wakes up.
export const WAKE_LIMIT = 4 * 60 * 1000;

// What a sleeping or just-waking host answers with (the host's gateway, not our app).
const SLEEPY = new Set([408, 425, 429, 502, 503, 504, 520, 521, 522, 523, 524]);

const pause = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

// Resolves with the parsed JSON. Gateway errors (502/503/504), dropped connections and the "waking up" page are asked again
// every few seconds, for up to WAKE_LIMIT. A clear answer like 404 or 500 is not retried. Abort the signal to stop.
export async function getJson(url, { signal, every = 3000, limit = WAKE_LIMIT } = {}) {
  const started = Date.now();
  for (;;) {
    let problem;
    try {
      const response = await fetch(url, { signal });
      if (response.ok) return await response.json();
      problem = new Error(`HTTP ${response.status}`);
      if (!SLEEPY.has(response.status)) throw Object.assign(problem, { final: true });
    } catch (error) {
      if ((signal && signal.aborted) || error.final) throw error;
      problem = error;
    }
    if (Date.now() - started >= limit) throw problem;
    await pause(every, signal);
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
  }
}
