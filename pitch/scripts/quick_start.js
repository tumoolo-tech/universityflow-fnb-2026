// Prints the judges' one-page quick start (../quick-start/quick-start.html) to
// ../UniversityFlow_Judges_Quick_Start.pdf, with the public code link filled in.
// Run from the repo root after `pnpm install`:
//   node pitch/scripts/quick_start.js https://github.com/<owner>/<repo>
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const repo = process.argv[2];
if (!repo) throw new Error('Pass the public code link: node pitch/scripts/quick_start.js <url>');
const SRC = path.join(__dirname, '..', 'quick-start', 'quick-start.html');
const TMP = path.join(__dirname, '..', 'quick-start', '.filled.html');
const OUT = path.join(__dirname, '..', 'UniversityFlow_Judges_Quick_Start.pdf');

(async () => {
  const html = fs.readFileSync(SRC, 'utf8').replace('{{REPO}}', repo.replace(/^https?:\/\//, ''));
  fs.writeFileSync(TMP, html);
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    await p.goto('file:///' + TMP.replace(/\\/g, '/'));
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = (fs.readFileSync(OUT, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log('wrote', OUT, pages, 'page(s)');
  } finally {
    await b.close();
    fs.unlinkSync(TMP);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
