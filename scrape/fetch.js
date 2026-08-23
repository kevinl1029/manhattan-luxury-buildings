import { setTimeout as sleep } from "node:timers/promises";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 manhattan-luxury-buildings/0.1";

const MIN_GAP_MS = 900;
let lastRequest = 0;

export async function fetchText(url, { retries = 1, timeoutMs = 12000, json = false } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const wait = Math.max(0, lastRequest + MIN_GAP_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
        headers: {
          "user-agent": UA,
          accept: json ? "application/json" : "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const text = await res.text();
      return { url: res.url, text };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(700 * (attempt + 1));
    }
  }
  throw lastErr;
}
