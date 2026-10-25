#!/usr/bin/env node
/**
 * What the browser downloads, checked after `next build` (audit A4-02).
 *
 * Client components once imported `@universityflow/catalogue`'s barrel for a subject's name. The
 * barrel builds zod schemas when it loads and holds every programme record, so seven pages
 * shipped a 99 KB gzipped chunk: a second zod with its ~40 locales, and admission data that only
 * the server should decide with (hard rule 2). This fails when any client chunk carries:
 *
 * - catalogue programme text ("Bachelor of", the Siyavula practice links), or
 * - a non-English zod locale (zod has come in whole).
 *
 * And it fails when sign-in or the guardian's consent page downloads copy that only the offers,
 * campus or My modules pages show (audit A4-10: a client component imported all of `en`).
 *
 * It also prints each page's first-load JavaScript, gzipped, so a change can be measured.
 *
 * Usage: node scripts/ci/client-chunks.mjs [apps/web/.next]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { LOCALE_MARKERS } from './root-chunk-budget.mjs';

/**
 * Text only the catalogue's data holds. Programme names start "Bachelor of"; the practice
 * records link to siyavula.com (lower case: the learner-facing copy says "Siyavula"); the public
 * TVET colleges' records (@universityflow/catalogue/colleges, server only) cite a circular on
 * mysedcol.co.za.
 */
export const CATALOGUE_MARKERS = ['Bachelor of', 'siyavula', 'mysedcol'];

function* files(dir, ext) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full, ext);
    else if (entry.name.endsWith(ext)) yield full;
  }
}

const posix = (path) => path.split(sep).join('/');

/** Every client chunk that carries catalogue data or zod's locales. */
export function checkClientChunks(nextDir) {
  const problems = [];
  let chunks = 0;
  for (const file of files(join(nextDir, 'static', 'chunks'), '.js')) {
    chunks++;
    const text = readFileSync(file, 'utf8');
    const name = posix(relative(nextDir, file));
    const data = CATALOGUE_MARKERS.find((m) => text.includes(m));
    if (data) {
      problems.push(
        `${name} carries catalogue data ("${data}"): import from @universityflow/catalogue/client, or pass what the page needs from the server`,
      );
    }
    const locale = LOCALE_MARKERS.find((m) => text.includes(m));
    if (locale) problems.push(`${name} carries zod's locales ("${locale}")`);
  }
  return { chunks, problems };
}

/** Every page's client JavaScript: route → the chunks it loads, root chunks included. */
export function routeChunks(nextDir) {
  const manifest = JSON.parse(readFileSync(join(nextDir, 'build-manifest.json'), 'utf8'));
  const root = manifest.rootMainFiles ?? [];
  const routes = new Map();
  for (const file of files(join(nextDir, 'server', 'app'), '_client-reference-manifest.js')) {
    const text = readFileSync(file, 'utf8');
    const entries = text.match(/"entryJSFiles":(\{.*?\})\}/)?.[1];
    if (!entries) continue;
    for (const [entry, chunks] of Object.entries(JSON.parse(entries))) {
      if (!/\/page$/.test(entry)) continue;
      const route = entry
        .replace(/^\[project\]\/apps\/web\/app/, '')
        .replace(/\/page$/, '')
        .replace(/\/\([^)]+\)/g, '');
      routes.set(route || '/', [...new Set([...root, ...chunks])]);
    }
  }
  return routes;
}

/** First-load JavaScript per page, gzipped: the root chunks plus the page's own. */
export function pageSizes(nextDir) {
  const gz = new Map();
  const size = (file) => {
    if (!gz.has(file)) gz.set(file, gzipSync(readFileSync(join(nextDir, file))).length);
    return gz.get(file);
  };
  const pages = [];
  for (const [route, chunks] of routeChunks(nextDir)) {
    const bytes = chunks.reduce((sum, f) => sum + size(f), 0);
    pages.push({ route, kb: Math.round((bytes / 1024) * 10) / 10 });
  }
  return pages.sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * Copy that only the offers, campus and My modules pages show (audit A4-10). A browser component
 * that imports the whole of `en` from @universityflow/content, instead of the sections it reads,
 * puts every string the product has on its page: sign-in once downloaded all three.
 */
export const PAGE_COPY_MARKERS = [
  'Accept this offer',
  'Look around another university',
  'These are my modules: check them',
];

/** Pages someone opens before they have an account, which must carry none of that copy. */
export const LEAN_ROUTES = ['/sign-in', '/consent/[token]'];

/** Each lean page whose JavaScript carries another page's copy, or that the build lacks. */
export function checkPageCopy(nextDir, lean = LEAN_ROUTES, markers = PAGE_COPY_MARKERS) {
  const routes = routeChunks(nextDir);
  const problems = [];
  for (const route of lean) {
    const chunks = routes.get(route);
    if (!chunks) {
      problems.push(`${route} is not in the build: update LEAN_ROUTES`);
      continue;
    }
    for (const chunk of chunks) {
      const text = readFileSync(join(nextDir, chunk), 'utf8');
      const marker = markers.find((m) => text.includes(m));
      if (marker) {
        problems.push(
          `${route} downloads ${chunk}, which carries copy from another page ("${marker}"): import the sections a client component reads from @universityflow/content, not \`en\``,
        );
      }
    }
  }
  return { routes: lean.length, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nextDir = process.argv[2] ?? 'apps/web/.next';
  for (const { route, kb } of pageSizes(nextDir)) console.log(`  ${route.padEnd(40)} ${kb} KB gz`);
  const { chunks, problems } = checkClientChunks(nextDir);
  const copy = checkPageCopy(nextDir);
  const all = [...problems, ...copy.problems];
  for (const problem of all) console.error(`✗ ${problem}`);
  if (all.length > 0) process.exit(1);
  console.log(`✓ ${chunks} client chunks, none with catalogue data or zod's locales`);
  console.log(`✓ ${LEAN_ROUTES.join(', ')} carry no other page's copy`);
}
