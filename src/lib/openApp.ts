/**
 * "Open the app" deep links for the showcase.
 *
 * The button uses an Android intent URL with the app's custom URL scheme
 * (which each app must declare in its AndroidManifest / Capacitor config).
 * If the app is installed, the scheme opens it; if not installed (or the
 * installed version predates the scheme), Chrome falls back to the given URL
 * (the APK download).
 *
 * NOTE: a package-only intent (MAIN + LAUNCHER + package, no scheme) does NOT
 * launch the app in Chrome — it falls through to the fallback URL. That is
 * why the button kept re-requesting the download even for installed apps.
 * The scheme is required.
 */

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Android/i.test(navigator.userAgent);
}

export function buildOpenAppIntentUrl(
  androidScheme: string,
  androidPackage: string,
  fallbackUrl: string,
): string {
  const fallback = encodeURIComponent(fallbackUrl);
  return (
    `intent://open#Intent;scheme=${androidScheme};` +
    `package=${androidPackage};` +
    `S.browser_fallback_url=${fallback};` +
    'end'
  );
}
