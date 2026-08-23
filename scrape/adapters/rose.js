import { clean, stripHtml, priceOf, bedsOf, bathsOf } from "../normalize.js";

export default async function scrape({ fetchText, building, config }) {
  const { text } = await fetchText(config.url, { retries: 1, timeoutMs: 25000 });
  const listings = [];
  const tableRe = /<table[^>]*data-beds=['"]([0-9.]+)['"][^>]*>([\s\S]*?)<\/table>/gi;
  for (const tm of text.matchAll(tableRe)) {
    const beds = Number(tm[1]);
    const rows = tm[2].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const rowHtml of rows) {
      if (/<th/i.test(rowHtml)) continue;
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
      if (cells.length < 8) continue;
      const unit = stripHtml(cells[0]);
      if (!unit || unit.length > 12) continue;
      const raw = {
        unit,
        beds,
        baths: bathsOf(stripHtml(cells[4])),
        sqft: null,
        price: priceOf(stripHtml(cells[5])),
        availability: stripHtml(cells[7]) || null,
        url: config.url,
      };
      const listing = clean(raw, building, "rose");
      if (listing) listings.push(listing);
    }
  }
  return listings;
}
