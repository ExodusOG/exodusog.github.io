import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const SITE_ORIGIN = "https://www.exodus-data.com";

// Walk repo, ignoring non-site folders
const IGNORE_DIRS = new Set([".git", ".github", "node_modules", "scripts"]);
const INCLUDE_HTML = new Set(["index.html"]);

// --- helpers ---
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

function posixRel(p) {
  return p.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function fileToUrl(filePath) {
  const rel = posixRel(filePath);
  if (rel === "index.html") return `${SITE_ORIGIN}/`;
  if (rel.endsWith("/index.html")) return `${SITE_ORIGIN}/${rel.slice(0, -"/index.html".length)}/`;
  return `${SITE_ORIGIN}/${rel}`;
}

function gitLastMod(filePath) {
  // YYYY-MM-DD of last commit touching file
  try {
    const cmd = `git log -1 --format=%cs -- "${filePath}"`;
    const out = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return out || null;
  } catch {
    return null;
  }
}

function gitFirstMod(filePath) {
  // YYYY-MM-DD of first commit introducing file
  try {
    const cmd = `git log --reverse --format=%cs -- "${filePath}" | head -n 1`;
    const out = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return out || null;
  } catch {
    return null;
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// --- 1) build sitemap.xml (auto lastmod) ---
function buildSitemap() {
  const all = walk(".");
  const pages = all
    .filter((f) => INCLUDE_HTML.has(path.basename(f)))
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
  console.log(`Generated sitemap.xml with ${urls.length} URLs`);
}

// --- 2) build EXODUS_SITE_PAGES_001 dataset.json (auto dates) ---
function buildSitePagesDataset() {
  const datasetDir = path.join("data", "EXODUS_SITE_PAGES_001");
  ensureDir(datasetDir);

  // If the landing page exists, use it for published/updated dates.
  // If it doesn't exist yet, we still generate dataset.json using repo root index.html as baseline.
  const landingHtml = path.join(datasetDir, "index.html");
  const dateSource = fs.existsSync(landingHtml) ? landingHtml : "index.html";

  const published_at = gitFirstMod(dateSource) || gitFirstMod("index.html") || null;
  const updated_at = gitLastMod(dateSource) || gitLastMod("index.html") || null;

  // Keep this list stable and explicit (business-grade, predictable).
  const pages = [
    { path: "/", url: `${SITE_ORIGIN}/`, type: "home", notes: "Primary entry point." },
    { path: "/data/", url: `${SITE_ORIGIN}/data/`, type: "collection", notes: "Dataset index." },
    { path: "/schema/", url: `${SITE_ORIGIN}/schema/`, type: "schema", notes: "Formatting conventions for datasets." },
    { path: "/pricing/", url: `${SITE_ORIGIN}/pricing/`, type: "commercial_licensing", notes: "Commercial licensing overview." },
    { path: "/about/", url: `${SITE_ORIGIN}/about/`, type: "about", notes: "Publishing principles." },
    { path: "/contact/", url: `${SITE_ORIGIN}/contact/`, type: "contact", notes: "Licensing and inquiries." },
    { path: "/license/", url: `${SITE_ORIGIN}/license/`, type: "license_policy", notes: "Human-readable policy page." },
    { path: "/LICENSE.txt", url: `${SITE_ORIGIN}/LICENSE.txt`, type: "machine_license", notes: "Authoritative machine-readable license text." },
    { path: "/robots.txt", url: `${SITE_ORIGIN}/robots.txt`, type: "crawler_policy", notes: "Crawler access and sitemap pointer." },
    { path: "/sitemap.xml", url: `${SITE_ORIGIN}/sitemap.xml`, type: "sitemap", notes: "XML sitemap for crawl discovery." }
  ];

  const dataset = {
    id: "EXODUS_SITE_PAGES_001",
    title: "Exodus Data — Site Pages Index",
    version: "1.0.0",
    ...(published_at ? { published_at } : {}),
    ...(updated_at ? { updated_at } : {}),
    license: `${SITE_ORIGIN}/license/`,
    machine_license: `${SITE_ORIGIN}/LICENSE.txt`,
    pricing: `${SITE_ORIGIN}/pricing/`,
    contact: `${SITE_ORIGIN}/contact/`,
    notes: [
      "Access, crawling, scraping, indexing, caching, and storage are permitted under the site license.",
      "No commercial rights are granted under the site license. Commercial use requires a paid commercial license.",
      "This dataset is auto-built from repository history to eliminate manual date maintenance."
    ],
    pages
  };

  const outPath = path.join(datasetDir, "dataset.json");
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2) + "\n", "utf8");
  console.log(`Generated ${outPath}`);
}

// Run both builders
buildSitemap();
buildSitePagesDataset();
