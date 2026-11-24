import { useEffect, useState } from 'react';

interface QrCodeGlobal {
  toDataURL: (
    text: string,
    options?: {
      width?: number;
      margin?: number;
      color?: { dark?: string; light?: string };
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    }
  ) => Promise<string>;
}

declare global {
  interface Window {
    QRCode?: QrCodeGlobal;
  }
}

interface QrCodeBoxProps {
  url: string;
  appName: string;
}

async function resolveQrGenerator(): Promise<QrCodeGlobal> {
  if (window.QRCode && typeof window.QRCode.toDataURL === 'function') {
    return window.QRCode;
  }

  // Wait briefly in case deferred CDN script in index.html is still finishing
  for (let i = 0; i < 15; i++) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (window.QRCode && typeof window.QRCode.toDataURL === 'function') {
      return window.QRCode;
    }
  }

  // Fallback to ESM CDN if deferred global script was blocked or delayed
  const cdnUrl = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm';
  const mod = (await import(/* @vite-ignore */ cdnUrl)) as {
    default?: QrCodeGlobal;
    toDataURL?: QrCodeGlobal['toDataURL'];
  };

  if (mod.default && typeof mod.default.toDataURL === 'function') {
    return mod.default;
  }
  if (typeof mod.toDataURL === 'function') {
    return { toDataURL: mod.toDataURL };
  }

  throw new Error('QRCode library unavailable');
}

export function QrCodeBox({ url, appName }: QrCodeBoxProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setHasError(false);

    resolveQrGenerator()
      .then((qr) =>
        qr.toDataURL(url, {
          width: 176,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#030712',
            light: '#ffffff',
          },
        })
      )
      .then((generatedUrl) => {
        if (active) {
          setDataUrl(generatedUrl);
        }
      })
      .catch(() => {
        if (active) {
          setHasError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  if (hasError) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-3.5 bg-[#071127] border border-sky-400/25 rounded-xl shrink-0">
      <div className="w-[144px] h-[144px] bg-white rounded-lg p-1.5 flex items-center justify-center overflow-hidden">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`رمز QR لتحميل تطبيق ${appName}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-xs text-slate-600 font-medium">
            جاري توليد الرمز...
          </span>
        )}
      </div>
      <span className="text-xs text-sky-200/90 text-center max-w-[150px] leading-snug">
        امسح الرمز للتحميل مباشرة على الهاتف
      </span>
    </div>
  );
}
