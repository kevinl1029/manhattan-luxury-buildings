import { mkdirSync, writeFileSync } from "node:fs";
import { fetchText } from "./fetch.js";
import { loadBuildings } from "./buildings.js";

const KNOWN_FEEDS = {
  "Ruby Chelsea": { adapter: "rose", url: "https://availability.rosenyc.com/availability/hgpiehrt/" },
  "EVGB": { adapter: "rentcafe", url: "https://evgb-rentcafewebsite.securecafe.com/onlineleasing/evgb/floorplans.aspx" },
};

const URL_RULES = [
  { re: /relatedrentals\.com/, adapter: "related", hint: "related-rentals" },
  { re: /rockrose\.com/, adapter: "rockrose", hint: "rockrose" },
  { re: /avaloncommunities\.com/, adapter: "entrata", hint: "avalon-entrata" },
  { re: /equityapartments\.com/, adapter: "equity", hint: "equity-residential" },
  { re: /stonehengenyc\.com/, adapter: "stonehenge", hint: "stonehenge" },
];

const HTML_RULES = [
  { re: /availability\.rosenyc\.com/, adapter: "rose", hint: "rose-associates" },
  { re: /(?:href|src)=["'][^"']*securecafe\.com[^"']*(?:floorplans|availability|residentservices\/apartmentsforrent)[^"']*["']/i, adapter: "rentcafe", hint: "rentcafe-securecafe" },
  { re: /jonahdigital|bozzuto/, adapter: "jonah", hint: "jonah-digital" },
  { re: /schema\.org\/Apartment|ResidentialApartment|"@type"\s*:\s*"Apartment"/, adapter: "jsonld", hint: "jsonld-units" },
  { re: /on-site\.com|rentcafe|yardi|realpage/i, adapter: "rentcafe", hint: "yardi-onsite" },
  { re: /gatsby|__NEXT_DATA__|page-data\.json|webpack|create-react-app|\.bundle\.js|nuxt/i, adapter: "spa", hint: "js-spa" },
  { re: /streeteasy\.com\/building/i, adapter: "streeteasy", hint: "streeteasy-link" },
  { re: /drupal/i, adapter: "drupal", hint: "drupal" },
  { re: /wp-json|wp-content/i, adapter: "wordpress", hint: "wordpress" },
];

const FEED_URL_RULES = [
  /(?:href|src)=["'](https?:\/\/[^"']*securecafe\.com[^"']*(?:floorplans|availability|residentservices\/apartmentsforrent)[^"']*)["']/gi,
  /(?:href|src)=["'](https?:\/\/[^"']*availability\.rosenyc\.com[^"']*)["']/gi,
];

const LINK_RULES = [
  /href=["'](https?:\/\/[^"']*(?:availability|availabilities|floorplans|floor-plans|units|residences)[^"']*)["']/gi,
  /href=["'](https?:\/\/streeteasy\.com\/building[^"']*)["']/gi,
];

const IFRAME_RULES = [
  /<iframe[^>]+src=["'](https?:\/\/[^"']*availability[^"']*)["']/gi,
  /<iframe[^>]+src=["'](https?:\/\/[^"']*(?:securecafe|rosenyc)[^"']*)["']/gi,
];

function detect(html, url) {
  const hints = [];
  for (const rule of URL_RULES) {
    if (rule.re.test(url)) {
      hints.push(rule.hint);
      return { adapter: rule.adapter, hints };
    }
  }
  for (const rule of HTML_RULES) {
    if (rule.re.test(html)) {
      hints.push(rule.hint);
      return { adapter: rule.adapter, hints };
    }
  }
  return { adapter: "generic", hints: [] };
}

function extractUrls(html, rules, limit = 3) {
  const out = [];
  for (const re of rules) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) && out.length < limit) {
      const href = m[1].replace(/&amp;/g, "&");
      if (!out.includes(href)) out.push(href);
    }
    if (out.length >= limit) break;
  }
  return out;
}

function yardiPropertyId(html) {
  const m = html.match(/on-site\.com\/(?:apply\/property\/|web\/online_app\/[^"]*property_id=)(\d+)/i);
  return m ? m[1] : null;
}

async function discover() {
  const buildings = loadBuildings();
  const out = { version: 1, generatedAt: new Date().toISOString(), buildings: [] };

  for (const b of buildings) {
    const rec = { name: b.n, address: b.a, hood: b.h, url: b.url ?? null };
    if (!b.url) {
      rec.adapter = "none";
      rec.status = "none";
      rec.hints = [];
      out.buildings.push(rec);
      continue;
    }
    const entry = { ...rec, adapter: null, status: "pending", hints: [], fetch: null, availabilityUrls: [], robots: null, yardiPropertyId: null };
    try {
      const home = await fetchText(b.url);
      const known = KNOWN_FEEDS[b.n];
      const { adapter, hints } = known ? { adapter: known.adapter, hints: [`known-feed:${known.adapter}`] } : detect(home.text, home.url);
      entry.adapter = adapter;
      entry.hints.push(...hints);
      entry.sourceUrl = home.url;
      entry.fetch = { status: "ok", title: (home.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim().slice(0, 160) ?? null };
      const feedUrls = extractUrls(home.text, FEED_URL_RULES, 4);
      const links = extractUrls(home.text, LINK_RULES);
      const iframes = extractUrls(home.text, IFRAME_RULES);
      if (known) entry.availabilityUrls.push(known.url);
      if (adapter === "streeteasy") {
        const se = links.find((l) => l.includes("streeteasy.com/building"));
        if (se) entry.availabilityUrls.push(se);
      } else {
        entry.availabilityUrls.push(...feedUrls, ...iframes, ...links.filter((l) => !l.includes("streeteasy.com/building")));
      }
      entry.availabilityUrls = [...new Set(entry.availabilityUrls)].filter((u) => !/scheduletour/i.test(u)).slice(0, 4);
      entry.yardiPropertyId = yardiPropertyId(home.text);
      if (entry.yardiPropertyId) entry.hints.push(`yardi-property-${entry.yardiPropertyId}`);
      try {
        const robots = await fetchText(new URL("/robots.txt", b.url).href, { retries: 1, timeoutMs: 8000 });
        const sitemaps = [...robots.text.matchAll(/^Sitemap:\s*(\S+)/gim)].map((m) => m[1]);
        entry.robots = { status: "ok", sitemaps };
        if (sitemaps.length) entry.hints.push("has-sitemap");
      } catch {
        entry.robots = { status: "unavailable" };
      }
    } catch (err) {
      const msg = String(err.message ?? err);
      const dead = /HTTP 40[14]/.test(msg);
      entry.adapter = dead ? "none" : "unknown";
      entry.status = dead ? "dead" : "error";
      entry.fetch = { status: dead ? "dead" : "error", error: msg.slice(0, 200) };
      if (dead) entry.hints.push("site-dead");
    }
    out.buildings.push(entry);
    console.log(`${entry.adapter.padEnd(10)} ${entry.fetch?.status.padEnd(7)} ${entry.name}${entry.availabilityUrls.length ? "  \u2192 " + entry.availabilityUrls[0] : ""}`);
  }

  mkdirSync("data", { recursive: true });
  writeFileSync("data/sources.json", JSON.stringify(out, null, 2) + "\n");

  const byAdapter = {};
  for (const b of out.buildings) byAdapter[b.adapter] = (byAdapter[b.adapter] ?? 0) + 1;
  const report = {
    generatedAt: out.generatedAt,
    total: out.buildings.length,
    byAdapter,
    buildings: out.buildings.map(({ name, hood, url, adapter, status, hints, availabilityUrls, yardiPropertyId }) => ({
      name, hood, url, adapter, status, hints, availabilityUrls, yardiPropertyId,
    })),
  };
  writeFileSync("data/discovery-report.json", JSON.stringify(report, null, 2) + "\n");
  console.log("\n--- coverage ---");
  for (const [k, v] of Object.entries(byAdapter).sort((a, b) => b[1] - a[1])) console.log(`${k.padEnd(12)} ${v}`);
}

discover().catch((err) => {
  console.error(err);
  process.exit(1);
});
