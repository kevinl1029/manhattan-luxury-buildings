import { clean } from "../normalize.js";

function extractArray(text, startMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return null;
  const i0 = start + startMarker.length;
  if (text[i0] !== "[") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = i0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return text.slice(i0, i + 1);
    }
  }
  return null;
}

export default async function scrape({ fetchText, building, config }) {
  const origin = config.origin;
  const { text } = await fetchText(config.floorplansUrl, { retries: 1, timeoutMs: 25000 });
  const raw = extractArray(text, '"units":');
  if (!raw) return [];
  let units;
  try {
    units = JSON.parse(raw);
  } catch {
    return [];
  }
  const listings = [];
  for (const u of units) {
    if (!u.apartment_number) continue;
    const rawListing = {
      unit: String(u.apartment_number).trim(),
      beds: u.bedrooms != null ? Number(u.bedrooms) : null,
      baths: u.bathrooms != null ? Number(u.bathrooms) : null,
      sqft: u.square_feet != null ? Number(u.square_feet) : null,
      price: u.rent_min != null ? Number(u.rent_min) : null,
      availability: u.available_display || u.available_date || null,
      url: u.permalink ? `${origin}${u.permalink}` : config.floorplansUrl,
    };
    const listing = clean(rawListing, building, "jonah");
    if (listing) listings.push(listing);
  }
  return listings;
}
