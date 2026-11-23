// Builds public/offline.html from the errors section of the content registry (design package v3). Runs before
// `next build` (package.json "prebuild"); the page is served by the service worker when there is no network,
// so it carries no fonts and no scripts.
//   node --experimental-strip-types scripts/build-offline.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_CONTENT_DEFAULTS } from "../src/lib/site-content.ts";

const t = SITE_CONTENT_DEFAULTS.errors;
const brand = SITE_CONTENT_DEFAULTS.home_nav.brand_name;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(brand)}: ${esc(t.offline_title)}</title>
  <link rel="icon" href="/favicon.ico">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Rubik, system-ui, -apple-system, "Segoe UI", sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #faf7f2; color: #0b051d; text-align: center; padding: 2rem; }
    .container { max-width: 400px; }
    h1 { font-size: 1.5rem; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 0.75rem; }
    p { font-size: 1rem; color: #2e2745; margin-bottom: 2rem; line-height: 1.6; }
    .btn { display: inline-block; padding: 0.85rem 2rem; background: #dc1363; color: #fff; border: none; border-radius: 9999px; font: 700 1rem Rubik, system-ui, sans-serif; cursor: pointer; }
    .btn:hover { background: #be1257; }
  </style>
</head>
<body>
  <div class="container">
    <img src="/icon-192.png" alt="" width="80" height="80" style="border-radius:20px;margin-bottom:1.5rem;box-shadow:0 16px 40px #0b051d1f">
    <h1>${esc(t.offline_title)}</h1>
    <p>${esc(t.offline_body)}</p>
    <button class="btn" onclick="location.reload()">${esc(t.offline_cta)}</button>
  </div>
</body>
</html>
`;

const target = join(process.cwd(), "public", "offline.html");
writeFileSync(target, html);
console.log("offline.html written from the content registry defaults");
