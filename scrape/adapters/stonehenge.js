import { clean, num } from "../normalize.js";

export default async function scrape({ fetchText, building, config }) {
  const { text } = await fetchText(config.url, { retries: 1, timeoutMs: 25000 });
  const listings = [];
  const chunks = text.split('class="apt-card-collection-item').slice(1);
  for (const chunk of chunks) {
    const buildingMatch = chunk.match(/fs-cmsfilter-field="building"[^>]*>([^<]+)</);
    if (!buildingMatch) continue;
    if (buildingMatch[1].trim().toLowerCase() !== building.name.toLowerCase()) continue;
    const unit = chunk.match(/text-size-medium">\s*([^<]+)</)?.[1]?.trim();
    if (!unit) continue;
    const bedsRaw = chunk.match(/fs-cmsfilter-field="Bedroom"[^>]*>\s*([^<]+)</)?.[1]?.trim();
    const beds = bedsRaw ? (/studio/i.test(bedsRaw) ? 0 : bedsRaw.match(/(\d+)/)?.[1] ?? null) : null;
    const bathsRaw = chunk.match(/fs-cmsfilter-field="Bathroom"[^>]*>\s*([\d.]+)</)?.[1];
    const sqft = chunk.match(/amenities-container hide[\s\S]*?fs-cmsfilter-field="Bedroom"[^>]*>\s*([\d,]+)</)?.[1];
    const price = chunk.match(/card-price">\s*([\d,]+)</)?.[1];
    const url = chunk.match(/href="(\/apartments\/[^"]+)"/)?.[1];
    const raw = {
      unit,
      beds,
      baths: num(bathsRaw),
      sqft: num(sqft),
      price: num(price),
      availability: null,
      url: url ? `https://www.stonehengenyc.com${url}` : config.url,
    };
    const listing = clean(raw, building, "stonehenge");
    if (listing) listings.push(listing);
  }
  return listings;
}
