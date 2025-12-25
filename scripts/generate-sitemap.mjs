import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const SITE_ORIGIN = "https://www.exodus-data.com";

const IGNORE_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  "scripts",
]);

const INCLUDE_FILENAMES = new Set(["index.html"]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function fileToUrl(filePath) {
  const rel = filePath.replace(/\\/g, "/").replace(/^\.?\//, "");

  if (rel === "index.html") return `${SITE_ORIGIN}/`;

  if (rel.endsWith("/index.html")) {
    const section = rel.slice(0, -"/index.html".length);
    return `${SITE_ORIGIN}/${section}/`;
  }

  return `${SITE_ORIGIN}/${rel}`;
}

function gitLastMod(filePath) {
  try {
    const cmd = `git log -1 --format=%cs -- "${filePath}"`;
    const out = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

const allFiles = walk(".");
const pages = allFiles
  .filter((f) => INCLUDE_FILENAMES.has(path.basename(f)))
  .map((f) => f.replace(/^\.\/?/, ""));

const urls = pages
  .map((file) => ({
    loc: fileToUrl(file),
    lastmod: gitLastMod(file),
  }))
  .sort((a, b) => a.loc.localeCompare(b.loc));

const xml = [];
xml.push(`<?xml version="1.0" encoding="UTF-8"?>`);
xml.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);

for (const u of urls) {
  xml.push(`  <url>`);
  xml.push(`    <loc>${u.loc}</loc>`);
  if (u.lastmod) xml.push(`    <lastmod>${u.lastmod}</lastmod>`);
  xml.push(`  </url>`);
}

xml.push(`</urlset>`);
xml.push("");

fs.writeFileSync("sitemap.xml", xml.join("\n"), "utf8");
console.log(`Generated sitemap.xml with ${urls.length} URLs.`);
