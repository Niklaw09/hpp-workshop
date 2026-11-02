import { QRCodeSVG } from 'qrcode.react';
import { joinUrl } from '../lib/ids';

export function JoinCard({ code, size = 'md' }: { code: string; size?: 'md' | 'lg' }) {
  const url = joinUrl(code);
  return (
    <div className={`join-card join-card--${size}`}>
      <QRCodeSVG value={url} size={size === 'lg' ? 320 : 168} marginSize={2} bgColor="#ffffff" fgColor="#1D2A33" level="M" />
      <div className="join-card__text">
        <p className="join-card__eyebrow">Follow along on your phone</p>
        <p className="join-card__url">{url.replace(/^https?:\/\//, '').replace(/\/join\/.*/, '/join')}</p>
        <p className="join-card__code">Code <strong>{code}</strong></p>
      </div>
    </div>
  );
}
