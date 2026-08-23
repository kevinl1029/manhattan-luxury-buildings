import { readFileSync } from "node:fs";

export function loadBuildings() {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const m = html.match(/const B = \[([\s\S]*?)\n\];/);
  if (!m) throw new Error("Could not locate `const B = [...]` in index.html");
  const src = m[1]
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n")
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  return JSON.parse(`[${src}]`);
}
