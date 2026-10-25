import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLines, rel, walk } from './lib/walk.mjs';

/**
 * Guard: nothing in `apps/*` or `packages/*` depends on a workspace tool in `tools/*`
 * (planning.md §18.8). A tool such as the results generator writes PDFs; if an app or a package
 * it ships reached it, that code would enter a bundle (and the native app's dependency walk,
 * gotcha 14). Tools may depend on packages; never the other way round.
 */

const IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/;
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

/** The package names of every workspace tool. */
function toolNames(root) {
  const dir = join(root, 'tools');
  if (!existsSync(dir)) return new Set();
  const names = new Set();
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'package.json');
    if (existsSync(file) && readJson(file).name) names.add(readJson(file).name);
  }
  return names;
}

function pointsIntoTools(specifier, tools) {
  if (/(^|\/)tools\//.test(specifier)) return true;
  return [...tools].some((name) => specifier === name || specifier.startsWith(`${name}/`));
}

export function run(root) {
  const tools = toolNames(root);
  const findings = [];

  for (const top of ['apps', 'packages']) {
    const dir = join(root, top);
    if (!existsSync(dir)) continue;

    for (const name of readdirSync(dir)) {
      const file = join(dir, name, 'package.json');
      if (!existsSync(file)) continue;
      const pkg = readJson(file);
      for (const field of DEPENDENCY_FIELDS) {
        for (const dep of Object.keys(pkg[field] ?? {})) {
          if (!tools.has(dep)) continue;
          const lines = readLines(file);
          const index = lines.findIndex((l) => l.includes(`"${dep}"`));
          findings.push({
            file: rel(root, file),
            line: index + 1,
            message: `lists the tool ${dep} (${field}). Tools are never a dependency of an app or package`,
            snippet: index >= 0 ? lines[index].trim() : dep,
          });
        }
      }
    }

    for (const file of walk(dir, ['.ts', '.tsx', '.mjs', '.js'])) {
      readLines(file).forEach((line, index) => {
        const match = IMPORT.exec(line);
        if (match?.[1] && pointsIntoTools(match[1], tools)) {
          findings.push({
            file: rel(root, file),
            line: index + 1,
            message: `imports a tool (${match[1]}). Tools never reach an app or a package`,
            snippet: line.trim(),
          });
        }
      });
    }
  }

  return findings;
}

export const meta = {
  id: 'tools-stay-private',
  description: 'no app or package depends on a workspace tool in tools/* (planning.md §18.8)',
};
