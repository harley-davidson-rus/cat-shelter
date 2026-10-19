import React, { useEffect, useState } from 'react';
import { detectSbpPaymentUrl, normalizeSbpPaymentUrl } from '../utils/paymentQr';

type PaymentQrImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  paymentUrl?: string | null;
};

export const PaymentQrImage: React.FC<PaymentQrImageProps> = ({ src, alt, className, style, paymentUrl, ...imageProps }) => {
  const explicitPaymentUrl = paymentUrl ? normalizeSbpPaymentUrl(paymentUrl) : null;
  const [detectedPaymentUrl, setDetectedPaymentUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDetectedPaymentUrl(null);
    if (explicitPaymentUrl) return () => { active = false; };
    if (typeof src !== 'string' || !src) return () => { active = false; };

    void detectSbpPaymentUrl(src).then((url) => {
      if (active) setDetectedPaymentUrl(url);
    });
    return () => { active = false; };
  }, [explicitPaymentUrl, src]);

  const resolvedPaymentUrl = explicitPaymentUrl || detectedPaymentUrl;

  const image = (
    <img
      {...imageProps}
      src={src}
      alt={alt}
      className={className}
      style={resolvedPaymentUrl
        ? { ...style, objectFit: 'contain', objectPosition: 'center', cursor: 'pointer' }
        : style}
    />
  );

  if (!resolvedPaymentUrl) return image;

  return (
    <a
      href={resolvedPaymentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="contents"
      aria-label="Открыть оплату через СБП в новой вкладке"
      title="Открыть оплату через СБП"
      onClick={(event) => event.stopPropagation()}
    >
      {image}
    </a>
  );
};
