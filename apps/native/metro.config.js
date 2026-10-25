const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Monorepo Metro config (from tumo-olo). Without it Metro doesn't watch `packages/*`, and the
 * app silently serves stale copies of shared code or fails to resolve it at all.
 */
/**
 * expo-router's NativeTabs can draw Material Symbols (`md`) icons on Android, which pulls
 * expo-symbols and its 944 KB Material Symbols font into every Android export (A4-05). The app
 * has no NativeTabs and draws no symbols, so Expo's own switch replaces that converter with a
 * stub when bundling for Android. Set here, not in a `.env`, so every bundle (dev, `expo export`,
 * EAS) gets it; `scripts/check-export.mjs` fails the build if a large font comes back.
 */
process.env.EXPO_ROUTER_DISABLE_NATIVE_TABS_MD = '1';

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole workspace so edits in packages/* trigger a rebuild.
config.watchFolders = [workspaceRoot];

// 2. Resolve from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Don't walk up the tree past those two, which prevents picking up a stray duplicate.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
