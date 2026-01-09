import fs from "fs";
import path from "path";

const SITE = "https://www.exodus-data.com"; // keep your preferred canonical host
const ROOT = process.cwd();

const EXCLUDE_FILES = new Set([
  "404.html",
  "robots.txt",
  "sitemap.xml",
]);

const EXCLUDE_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  "scripts",
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      out.push(...walk(path.join(dir, e.name)));
    } else if (e.isFile()) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function toUrl(filePath) {
  // filePath is absolute or relative to ROOT; normalize to relative posix
  const rel = path.relative(ROOT, filePath).split(path.sep).join("/");

  // Only .html files
  if (!rel.endsWith(".html")) return null;

  const baseName = path.basename(rel);
  if (EXCLUDE_FILES.has(baseName)) return null;

  // Convert:
  // index.html -> /
  // pricing/index.html -> /pricing/
  // about.html -> /about.html (if you use flat files), but we prefer directory index pages.
  let urlPath = rel;

  if (urlPath === "index.html") {
    urlPath = "/";
  } else if (urlPath.endsWith("/index.html")) {
    urlPath = "/" + urlPath.replace(/\/index\.html$/, "/");
  } else {
    // If you have flat pages like about.html at root, keep them as /about.html
    urlPath = "/" + urlPath;
  }

  // Avoid double slashes
  urlPath = urlPath.replace(/\/\/+/g, "/");
  return SITE + urlPath;
}

const files = walk(ROOT);
const urls = files
  .map(toUrl)
  .filter(Boolean)
  // de-dupe
  .filter((u, i, arr) => arr.indexOf(u) === i)
  // stable sort
  .sort((a, b) => a.localeCompare(b));

const now = new Date().toISOString();

const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u}</loc>
    <lastmod>${now}</lastmod>
  </url>`).join("\n")}
</urlset>
`;

fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
console.log(`Generated sitemap.xml with ${urls.length} URLs`);
