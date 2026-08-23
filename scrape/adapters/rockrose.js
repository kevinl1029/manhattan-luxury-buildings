import { clean, bedsOf } from "../normalize.js";

const FEED = "https://rockrose.com/availabilities/";

function sizeBeds(sizeJson) {
  try {
    const sizes = JSON.parse(sizeJson.replace(/'/g, '"'));
    const s = (sizes[0] || "").toLowerCase();
    const m = s.match(/^(\d+)-bedroom/);
    if (m) return Number(m[1]);
    if (s.startsWith("studio")) return 0;
  } catch {}
  return null;
}

export default async function scrape({ fetchText, building, config }) {
  const { text } = await fetchText(FEED, { retries: 1, timeoutMs: 25000 });
  const slug = config.slug;
  const listings = [];
  const chunks = text.split("<li class='col-xs-12");
  for (const chunk of chunks.slice(1)) {
    if (!chunk.includes("grid-card__listing-card")) continue;
    const buildingMatch = chunk.match(/data-building='(\[[^\]]*\])'/);
    if (!buildingMatch) continue;
    try {
      const buildings = JSON.parse(buildingMatch[1].replace(/'/g, '"'));
      if (!buildings.includes(slug)) continue;
    } catch {
      continue;
    }
    const size = chunk.match(/data-size='(\[[^\]]*\])'/);
    const price = chunk.match(/data-price='([\d.]+)'/)?.[1];
    const unit = chunk.match(/<span class='address'>#([^<]+)</)?.[1]?.trim();
    const sizeText = chunk.match(/<li class='size'>\s*([^<]+)</)?.[1]?.trim();
    const link = chunk.match(/href="(https:\/\/rockrose\.com\/listing\/[^"]+)"/)?.[1];
    const baths = (sizeText || "").match(/(\d+(?:\.\d+)?)\s*Bath/)?.[1];
    const raw = {
      unit: unit ? `#${unit}` : null,
      beds: sizeBeds(size?.[1] || ""),
      baths,
      sqft: null,
      price,
      availability: null,
      url: link || FEED,
    };
    const listing = clean(raw, building, "rockrose");
    if (listing) listings.push(listing);
  }
  return listings;
}
