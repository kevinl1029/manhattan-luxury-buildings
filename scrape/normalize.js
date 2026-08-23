export const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export const priceOf = (v) => {
  if (v === null || v === undefined) return null;
  const m = String(v).match(/\$?\s?([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

export const bedsOf = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).toLowerCase();
  if (/studio/.test(s)) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:bd|bed)/);
  if (m) return Number(m[1]);
  return null;
};

export const bathsOf = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*ba/);
  if (m) return Number(m[1]);
  if (/bath/.test(s)) return null;
  return null;
};

export const sqftOf = (v) => {
  if (v === null || v === undefined) return null;
  const m = String(v).match(/[\d,]+(?=\s*(?:sq\.?\s*ft|sf|sqft))/i);
  if (m) return Number(m[0].replace(/,/g, ""));
  return null;
};

export const stripHtml = (h) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;|&#038;/g, (m) => (m === "&amp;" || m === "&#038;" ? "&" : " "))
    .replace(/\s+/g, " ")
    .trim();

export function clean(raw, building, source) {
  const listing = {
    building: building.name,
    unit: raw.unit != null ? String(raw.unit).trim() : null,
    beds: num(raw.beds),
    baths: num(raw.baths),
    sqft: num(raw.sqft),
    price: num(raw.price),
    availability: raw.availability ? String(raw.availability).trim() : null,
    source,
    url: raw.url || building.url || null,
  };
  if (listing.unit === "" || listing.unit === null) listing.unit = null;
  if (listing.unit === null && listing.price === null) return null;
  return listing;
}
