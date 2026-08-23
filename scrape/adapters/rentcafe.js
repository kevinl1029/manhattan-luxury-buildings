import { clean, num } from "../normalize.js";

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

export default async function scrape({ fetchText, building, config }) {
  const origin = config.origin;
  let slug = config.slug;
  let host = null;
  const listings = [];

  if (!slug) {
    try {
      const { text } = await fetchText(building.url, { retries: 1, timeoutMs: 15000 });
      const link = text.match(/https?:\/\/([\w-]+\.securecafe\.com)\/onlineleasing\/([^/"']+)/i);
      if (link) {
        host = link[1];
        slug = link[2];
      }
    } catch {}
  }

  const tryMobileApi = async () => {
    if (!slug) return false;
    const api = new URL(`/onlineleasing/${slug}/mobileapi.aspx`, host ? `https://${host}` : origin);
    api.search = new URLSearchParams({
      requestType: "floorplans",
      myRentCafeApiAction: "search",
      startrow: "0",
      pagination: "false",
    });
    const { text } = await fetchText(api.href, { json: true, timeoutMs: 20000 });
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return false;
    let found = 0;
    for (const u of data) {
      const unit = pick(u, ["unitName", "unit_name", "unit", "name"]);
      const price = pick(u, ["rent", "rentmin", "minrent", "rentMin"]);
      const raw = {
        unit,
        beds: pick(u, ["bedroom", "bedrooms", "beds"]),
        baths: pick(u, ["bathroom", "bathrooms", "baths"]),
        sqft: pick(u, ["sqft", "squareFeet", "sqftmin"]),
        price,
        availability: pick(u, ["availabilityDate", "availableDate", "moveInDate", "availability"]),
        url: `${host ? `https://${host}` : origin}/onlineleasing/${slug}/floorplans`,
      };
      const listing = clean(raw, building, "rentcafe");
      if (listing) {
        found++;
        listings.push(listing);
      }
    }
    return found > 0;
  };

  try {
    const ok = await tryMobileApi();
    if (ok) return listings;
  } catch {}

  const code = config.propertyCode || null;
  const tryApi = async (propertyCode) => {
    const api = new URL("https://www.rentcafe.com/rentcafeapi.aspx");
    api.search = new URLSearchParams({
      requestType: "floorplans",
      propertyCode,
      myRentCafeApiAction: "search",
      startrow: "0",
      pagination: "false",
    });
    const { text } = await fetchText(api.href, { json: true, timeoutMs: 20000 });
    const data = JSON.parse(text);
    if (!Array.isArray(data) || data[0]?.Error) return false;
    let found = 0;
    for (const f of data) {
      const raw = {
        unit: pick(f, ["name", "floorplanName", "floorplan"]),
        beds: pick(f, ["bedroom", "bedrooms", "beds", "minBedroom"]),
        baths: pick(f, ["bathroom", "bathrooms", "baths", "minBathroom"]),
        sqft: pick(f, ["sqft", "squareFeet", "minsqft"]),
        price: pick(f, ["rent", "rentmin", "minrent", "rentMin", "effectiveRent"]),
        availability: pick(f, ["availabilityDate", "availableDate", "availability"]),
        url: `${origin}/onlineleasing/${slug}/floorplans`,
      };
      const listing = clean(raw, building, "rentcafe");
      if (listing) {
        found++;
        listings.push(listing);
      }
    }
    return found > 0;
  };

  if (code) {
    try {
      if (await tryApi(code)) return listings;
    } catch {}
  }

  if (slug) {
    try {
      const { text } = await fetchText(`${host ? `https://${host}` : origin}/onlineleasing/${slug}/floorplans`, { retries: 1, timeoutMs: 20000 });
      const foundCode =
        text.match(/propertyCode["']?\s*[:=]\s*["']([A-Za-z0-9]{4,8})["']/i)?.[1] ||
        text.match(/\b[A-Z]{4}\d{3}\b/)?.[0];
      if (foundCode && foundCode !== code) {
        try {
          if (await tryApi(foundCode)) return listings;
        } catch {}
      }
    } catch {}
  }

  return listings;
}
