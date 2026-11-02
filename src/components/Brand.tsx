import { presenterBrand } from '../content/slides';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <img src="/favicon.svg" alt="" width={compact ? 22 : 30} height={compact ? 22 : 30} />
      <span>{presenterBrand}</span>
    </div>
  );
}
