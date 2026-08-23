import { clean, bedsOf, bathsOf } from "../normalize.js";

const ORIGIN = "https://www.relatedrentals.com";

function findJson(root, key) {
  if (!root || typeof root !== "object") return null;
  if (Array.isArray(root)) {
    for (const item of root) {
      const hit = findJson(item, key);
      if (hit) return hit;
    }
    return null;
  }
  if (key in root) return root[key];
  for (const v of Object.values(root)) {
    const hit = findJson(v, key);
    if (hit) return hit;
  }
  return null;
}

export default async function scrape({ fetchText, building, config }) {
  const { text } = await fetchText(config.url, { retries: 1, timeoutMs: 25000 });
  const listings = [];

  const settingsMatch = text.match(/<script type="application\/json" data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/);
  const unitsJson = settingsMatch ? findJson(JSON.parse(settingsMatch[1]), "relatedUnitsView") : null;

  if (Array.isArray(unitsJson)) {
    for (const u of unitsJson) {
      const raw = {
        unit: u.name || null,
        beds: bedsOf(u.variant || u.dimension6),
        baths: bathsOf(u.variant || u.dimension7),
        sqft: null,
        price: u.price != null ? Number(u.price) : null,
        availability: u.dimension9 || null,
        url: config.url,
      };
      const listing = clean(raw, building, "related");
      if (listing) listings.push(listing);
    }
    return listings;
  }

  const cardRe = /<article class="node node--type-unit[^>]*data-api-id="(\d+)"[^>]*data-price="(\d+)"[^>]*data-variant="([^"]*)"[^>]*data-dimension9="([^"]*)"[^>]*>([\s\S]*?)<\/article>/gi;
  for (const m of text.matchAll(cardRe)) {
    const name = (m[5].match(/class="title">([\s\S]*?)</) || [])[1]?.trim() || null;
    const raw = {
      unit: name || `Unit ${m[1]}`,
      beds: bedsOf(m[3]),
      baths: bathsOf(m[3]),
      sqft: null,
      price: Number(m[2]),
      availability: m[4] || null,
      url: config.url,
    };
    const listing = clean(raw, building, "related");
    if (listing) listings.push(listing);
  }
  return listings;
}
