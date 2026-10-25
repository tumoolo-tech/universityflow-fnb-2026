// Captures screenshots of the LIVE judge demo (made-up learners only) for the pitch deck.
// Never types real personal details. Run from the repo root after `pnpm install`:
//   node pitch/scripts/screenshots.js [outDir]
// Raw PNGs go to outDir (default: pitch/scripts/raw, git-ignored); prep_images.py copies them as PNG.
// High pixel density, so nothing is ever upscaled: laptop 1440x900 at 2x (2880x1800), phone 390x844 at 3x (1170x2532).
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const BASE = 'https://universityflow.tumoolo.tech';
const OUT = process.argv[2] || path.join(__dirname, 'raw');
fs.mkdirSync(OUT, { recursive: true });

const LAPTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const LAPTOP_DSF = 2;
const PHONE_DSF = 3;

// learner -> pages to capture
const PLAN = {
  Thabo: ['/home', '/subjects'],
  Naledi: ['/home', '/results', '/results/what-i-need/uj-bcom-accounting', '/goals'],
  Amahle: ['/home', '/applications', '/funding', '/help'],
  Lerato: ['/home', '/first-week', '/campus', '/modules'],
  Sipho: ['/home', '/modules', '/cv'],
  Kagiso: ['/home', '/cv'],
};
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

async function settle(p) {
  await p.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  // Every web font, and every image in view, loaded before the shot (lazy images below the
  // fold never load, so only those in the viewport are awaited, and never for more than 10 s).
  await p.evaluate(async () => {
    await document.fonts.ready;
    const inView = [...document.images].filter((i) => {
      const r = i.getBoundingClientRect();
      return !i.complete && r.bottom > 0 && r.top < innerHeight;
    });
    const loaded = Promise.all(
      inView.map(
        (i) =>
          new Promise((r) => {
            i.addEventListener('load', r, { once: true });
            i.addEventListener('error', r, { once: true });
          }),
      ),
    );
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 10000))]);
  });
  await p.waitForTimeout(1500);
}
// The deck shows no university logo (no permission) and no helpline number a person has not yet
// verified (the catalogue's helplines are drafts), so both are hidden or blurred before each shot.
const DECK_CSS = `
  img[src*="demo-logos"], *:has(> img[src*="demo-logos"]) { display: none !important; }
  a[href^="tel:"], a[href^="sms:"] { filter: blur(7px) !important; }
  [class*="bg-warning-soft"][class*="border-b"] > p ~ p { display: none !important; }
`;
// The last rule drops the demo banner's logo notices (the logos are hidden above); its first line,
// "Demo: made-up learners", stays on every shot.
async function shot(p, name) {
  await p.addStyleTag({ content: DECK_CSS });
  await p.waitForTimeout(300);
  const file = path.join(OUT, name + '.png');
  await p.screenshot({ path: file });
  console.log('shot', name);
}
const slug = (u) => u.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'landing';

(async () => {
  const b = await chromium.launch();
  if (!ONLY || ONLY.includes('public')) {
    for (const [vp, tag, dsf] of [
      [LAPTOP, 'laptop', LAPTOP_DSF],
      [PHONE, 'phone', PHONE_DSF],
    ]) {
      const ctx = await b.newContext({
        viewport: vp,
        deviceScaleFactor: dsf,
        reducedMotion: 'reduce',
      });
      const p = await ctx.newPage();
      for (const u of ['/', '/demo', '/demo/new-learner', '/demo/guide']) {
        await p.goto(BASE + u, { timeout: 60000 });
        await settle(p);
        await shot(p, `public-${slug(u)}-${tag}`);
      }
      await ctx.close();
    }
  }
  for (const [who, pages] of Object.entries(PLAN)) {
    if (ONLY && !ONLY.includes(who)) continue;
    const ctx = await b.newContext({
      viewport: LAPTOP,
      deviceScaleFactor: LAPTOP_DSF,
      reducedMotion: 'reduce',
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(120000);
    for (let attempt = 1; ; attempt++) {
      try {
        await p.goto(BASE + '/demo', { timeout: 60000 });
        await settle(p);
        await p.getByRole('button', { name: `Try as ${who}` }).click({ noWaitAfter: true });
        await p.waitForURL((u) => !u.pathname.startsWith('/demo'), { timeout: 120000 });
        break;
      } catch (e) {
        if (attempt >= 3) throw e;
        console.log('retry', who, attempt);
      }
    }
    await settle(p);
    for (const u of pages) {
      await p.goto(BASE + u, { timeout: 60000 });
      await settle(p);
      await shot(p, `${who.toLowerCase()}-${slug(u)}-laptop`);
      if (process.env.LINKS)
        console.log(
          await p.evaluate(() =>
            [...document.querySelectorAll('main a, main button')]
              .map(
                (a) =>
                  (a.innerText || '').replace(/\s+/g, ' ').slice(0, 50) +
                  ' -> ' +
                  (a.getAttribute('href') || ''),
              )
              .join('\n'),
          ),
        );
    }
    // The same learner's copy (its cookies) in a phone-sized context at 3x.
    const state = await ctx.storageState();
    await ctx.close();
    const pctx = await b.newContext({
      viewport: PHONE,
      deviceScaleFactor: PHONE_DSF,
      reducedMotion: 'reduce',
      storageState: state,
    });
    const pp = await pctx.newPage();
    pp.setDefaultTimeout(120000);
    for (const u of pages) {
      await pp.goto(BASE + u, { timeout: 60000 });
      await settle(pp);
      await shot(pp, `${who.toLowerCase()}-${slug(u)}-phone`);
    }
    await pctx.close();
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
