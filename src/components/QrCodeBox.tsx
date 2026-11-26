import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

interface QrCodeBoxProps {
  url: string;
  appName: string;
}

export function QrCodeBox({ url, appName }: QrCodeBoxProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setHasError(false);

    // QR library is bundled locally (npm package "qrcode") — no
    // third-party CDN script is loaded for this anymore.
    QRCode.toDataURL(url, {
      width: 176,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#030712',
        light: '#ffffff',
      },
    })
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
