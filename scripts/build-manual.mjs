// Builds the User Manual PDF from docs/manual/user-manual.md.
//   pnpm manual
// Markdown → HTML (marked) → PDF (headless Chrome or Edge). Images are referenced relative to docs/manual/.
// Set CHROME_PATH to use a specific browser.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manualDir = path.join(root, "docs", "manual");
const source = path.join(manualDir, "user-manual.md");
const output = path.join(manualDir, "RoboSim-Studio-User-Manual.pdf");

// --- Read Markdown and its front matter -------------------------------------------------------
const raw = readFileSync(source, "utf8");
const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
const meta = Object.fromEntries(
  (fm?.[1] ?? "")
    .split(/\r?\n/)
    .map((line) => line.split(/:\s*/, 2))
    .filter((pair) => pair.length === 2),
);
const body = fm ? raw.slice(fm[0].length) : raw;

// --- Markdown → HTML, with a table of contents from the top-level headings ---------------------
const toc = [];
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slug(text.replace(/<[^>]+>/g, ""));
      if (depth <= 2) toc.push({ depth, text, id });
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    image({ href, title, text }) {
      const caption = title || text;
      return `<figure><img src="${href}" alt="${text}"><figcaption>${caption}</figcaption></figure>`;
    },
  },
});
const content = marked.parse(body);
const tocHtml = toc
  .map((t) => `<li class="toc-${t.depth}"><a href="#${t.id}">${t.text}</a></li>`)
  .join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<base href="${pathToFileURL(manualDir + path.sep).href}">
<title>${meta.title ?? "User Manual"}</title>
<style>
  /* Print layout: every block flows normally (no fixed heights or flex), so nothing can overlap. */
  @page {
    size: A4;
    margin: 20mm 18mm 22mm;
    @bottom-left { content: "RoboSim Studio · User Manual"; font: 8pt "Segoe UI", sans-serif; color: #94a3b8; }
    @bottom-right { content: counter(page); font: 8pt "Segoe UI", sans-serif; color: #94a3b8; }
  }
  @page cover { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }
  :root { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --accent:#0e7490; --accent-2:#1d4ed8; --soft:#f8fafc; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; }
  body { font: 10.5pt/1.6 "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--ink); }

  /* Cover: its own page with no margins */
  .cover { page: cover; break-after: page; height: 297mm; overflow: hidden; position: relative;
           background: linear-gradient(160deg, #0b1220 0%, #0f2a3d 55%, #0e7490 130%); color: #e2e8f0; }
  .cover-inner { position: absolute; left: 24mm; right: 24mm; top: 90mm; }
  .cover .kicker { letter-spacing: .22em; text-transform: uppercase; font-size: 9pt; color: #67e8f9; font-weight: 700; }
  .cover .title { font-size: 40pt; font-weight: 700; line-height: 1.1; margin: 10px 0 12px; color: #ffffff; }
  .cover .rule { width: 60mm; height: 4px; border-radius: 2px; background: linear-gradient(90deg, #22d3ee, #3b82f6); margin: 0 0 14px; }
  .cover .sub { font-size: 14pt; color: #cbd5e1; max-width: 140mm; }
  .cover .meta { position: absolute; left: 24mm; bottom: 24mm; font-size: 10pt; color: #94a3b8; line-height: 1.7; }

  /* Contents page */
  .toc { break-after: page; }
  .toc .heading { font-size: 20pt; font-weight: 700; margin: 0 0 4mm; }
  .toc ol { list-style: none; padding: 0; margin: 0; }
  .toc li { display: block; padding: 7px 0; border-bottom: 1px solid var(--line); }
  .toc li.toc-1 { font-weight: 600; font-size: 11pt; }
  .toc li.toc-2 { padding-left: 8mm; font-size: 10pt; color: #334155; border-bottom-style: dotted; }
  .toc a { color: inherit; text-decoration: none; }

  /* Chapters: every top-level heading starts a new page */
  main h1 { break-before: page; font-size: 20pt; line-height: 1.25; margin: 0 0 6mm; padding: 0 0 3mm;
            border-bottom: 2px solid var(--accent); }
  main h2 { font-size: 13.5pt; color: var(--accent); margin: 8mm 0 3mm; break-after: avoid; }
  main h3 { font-size: 11.5pt; margin: 6mm 0 2mm; break-after: avoid; }
  p, ul, ol { margin: 0 0 3.5mm; }
  ul { padding-left: 6mm; }
  li { margin-bottom: 1mm; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0 6mm; font-size: 9.5pt; break-inside: avoid; }
  th { background: #eef6f8; color: #0f3a47; text-align: left; font-weight: 600; }
  th, td { border: 1px solid var(--line); padding: 2.2mm 3mm; vertical-align: top; }
  tr:nth-child(even) td { background: var(--soft); }
  code { background: #f1f5f9; padding: 0 4px; border-radius: 3px; font-size: 9.5pt; }
  figure { margin: 3mm 0 7mm; break-inside: avoid; }
  figure img { display: block; width: 100%; border: 1px solid var(--line); border-radius: 4px; }
  figcaption { font-size: 9pt; color: var(--muted); text-align: center; margin-top: 2mm; font-style: italic; }
  strong { font-weight: 600; }
</style></head><body>
<section class="cover"><div class="cover-inner">
  <div class="kicker">User Manual</div>
  <div class="title">RoboSim Studio</div>
  <div class="rule"></div>
  <div class="sub">A free, open-source robotics lab that runs in your browser</div>
</div>
<div class="meta">Software version ${meta.version ?? "—"}<br>Updated ${meta.updated ?? "—"}<br>MIT licence</div>
</section>
<section class="toc"><div class="heading">Contents</div><ol>${tocHtml}</ol></section>
<main>
${content}
</main>
</body></html>`;

// --- HTML → PDF with headless Chrome / Edge ----------------------------------------------------
const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) throw new Error("No Chrome/Edge found. Set CHROME_PATH to a Chromium-based browser.");

const tmp = mkdtempSync(path.join(tmpdir(), "rss-manual-"));
const htmlFile = path.join(tmp, "manual.html");
writeFileSync(htmlFile, html);
// Optional: keep a copy of the HTML for checking the layout (MANUAL_HTML=path/to/file.html).
if (process.env.MANUAL_HTML) writeFileSync(process.env.MANUAL_HTML, html);
try {
  execFileSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--user-data-dir=${path.join(tmp, "profile")}`,
      `--print-to-pdf=${output}`,
      pathToFileURL(htmlFile).href,
    ],
    { stdio: "ignore" },
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (!existsSync(output)) throw new Error("PDF was not created.");
console.log(`Manual written: ${path.relative(root, output)}`);
