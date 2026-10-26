import { existsSync, readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Loads the web app's own configuration reader (apps/web/lib/server/config.ts) straight from its
 * TypeScript source, so `pnpm deploy:check` runs the very rules the deployed app runs, never a
 * copy of them that could drift.
 *
 * Node runs TypeScript itself, but the app's sources need three things it doesn't do on its own:
 * - relative imports without an extension (`./sms-providers`), resolved to the `.ts` file;
 * - `server-only`, which throws outside a React Server build: here it resolves to the package's
 *   own empty module, exactly what Next uses on the server;
 * - TypeScript that is more than types (a constructor's parameter properties in a package), so
 *   each `.ts` file is transformed, not only stripped, with Node's own `stripTypeScriptTypes`;
 * and JSON imports from TypeScript get the `type: 'json'` attribute Node asks for.
 *
 * It reads; it never writes a file.
 */

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Node marks `stripTypeScriptTypes` experimental and says so on stderr: quiet that one line, so
// the check's output is only the check. Every other warning still prints.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  if (String(warning?.message ?? warning).includes('stripTypeScriptTypes')) return;
  return emitWarning.call(process, warning, ...rest);
};

const TS = /\.(?:[cm]?ts|tsx)$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      const empty = resolve(ROOT, 'node_modules/server-only/empty.js');
      return nextResolve(pathToFileURL(empty).href, context);
    }
    const fromTs = Boolean(context.parentURL && TS.test(new URL(context.parentURL).pathname));
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (fromTs && relative && !/\.[cm]?[jt]sx?$|\.json$/.test(specifier)) {
      const base = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    if (fromTs && specifier.endsWith('.json')) {
      const attributes = { ...context.importAttributes, type: 'json' };
      const resolved = nextResolve(specifier, { ...context, importAttributes: attributes });
      return { ...resolved, importAttributes: attributes };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && TS.test(new URL(url).pathname)) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      return {
        format: 'module',
        shortCircuit: true,
        source: stripTypeScriptTypes(source, { mode: 'transform', sourceUrl: url }),
      };
    }
    return nextLoad(url, context);
  },
});

const at = (path) => pathToFileURL(resolve(ROOT, path)).href;

/**
 * The app's configuration module, and the live adapters it knows today (the same registries
 * `readConfig` reads by default).
 */
export async function loadAppConfig() {
  const config = await import(at('apps/web/lib/server/config.ts'));
  const sms = await import(at('apps/web/lib/server/sms-providers.ts'));
  const messaging = await import(at('apps/web/lib/server/messaging-providers.ts'));
  const jobs = await import(at('apps/web/lib/server/job-providers.ts'));
  const cv = await import(at('apps/web/lib/server/cv-providers.ts'));
  return {
    readConfig: config.readConfig,
    /** Where production must run: readConfig refuses any other Vercel region. */
    REQUIRED_FUNCTION_REGION: config.REQUIRED_FUNCTION_REGION,
    ConfigError: config.ConfigError,
    /** readConfig's own default, spelled out so a check can add to it. */
    adapters: () => ({
      sms: Object.keys(sms.SMS_ADAPTERS),
      jobs: Object.keys(jobs.JOB_ADAPTERS),
      whatsapp: Object.keys(messaging.WHATSAPP_ADAPTERS),
      push: Object.keys(messaging.PUSH_ADAPTERS),
      cv: Object.keys(cv.CV_ADAPTERS),
      inbound: {
        sms: sms.receivingAdapters(sms.SMS_ADAPTERS),
        whatsapp: sms.receivingAdapters(messaging.WHATSAPP_ADAPTERS),
      },
    }),
  };
}
