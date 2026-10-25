/**
 * The app's screen for a page the web names (`HomeData`'s next step and journey links are web
 * paths, built by shared code). Null where the app has no screen of its own yet (applications,
 * funding): the home then says to open the web instead of linking nowhere.
 */
const SAME = new Set([
  '/results',
  '/goals',
  '/offers',
  '/campus',
  '/first-week',
  '/modules',
  '/chat',
  '/subjects',
]);

export function nativeRoute(href: string): string | null {
  // A section of a page (`/goals#practice`, G10-4) opens the screen: the app has no anchors.
  const webPath = href.split('#')[0] ?? href;
  if (webPath === '/documents') return '/upload';
  if (webPath === '/me') return '/account';
  if (SAME.has(webPath)) return webPath;
  const whatINeed = /^\/results\/what-i-need\/([^/]+)$/.exec(webPath);
  if (whatINeed) return `/what-i-need/${whatINeed[1]}`;
  return null;
}
