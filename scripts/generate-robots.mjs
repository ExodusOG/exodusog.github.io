import fs from "fs";
import path from "path";

const SITE = "https://www.exodus-data.com";

const robots =
`User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

fs.writeFileSync(path.join(process.cwd(), "robots.txt"), robots, "utf8");
console.log("Generated robots.txt");
