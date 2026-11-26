// Share helpers for the apps showcase (منصة أبو معاذ).
// One share flow everywhere: native Web Share sheet when the browser
// offers it, otherwise a small menu with WhatsApp / Telegram / copy link.

export function buildAppShareUrl(repo: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/app/${encodeURIComponent(repo)}`;
}

export function buildPlatformShareUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function buildShareText(appName?: string): string {
  return appName
    ? `جرّب تطبيق ${appName} من منصة أبو معاذ`
    : 'منصة أبو معاذ — حمّل أحدث إصدارات تطبيقات المطور أبو معاذ';
}

export async function nativeShare(
  shareData: ShareData,
): Promise<'shared' | 'unavailable' | 'cancelled'> {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      return 'unavailable';
    }
  }
  return 'unavailable';
}

export function whatsappShareUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

export function telegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}
