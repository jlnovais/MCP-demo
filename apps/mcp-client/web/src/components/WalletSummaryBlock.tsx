import { memo } from 'react';
import './WalletSummaryBlock.css';

export type WalletSummarySpec = {
  userId: string;
  merchantId: string;
  credits: number | null;
  currency: string;
  fetchedAt: string;
  ok: boolean;
  error?: string;
};

export function parseWalletSummarySpec(raw: string): WalletSummarySpec | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.userId !== 'string' || typeof obj.merchantId !== 'string') {
    return null;
  }
  if (typeof obj.currency !== 'string' || typeof obj.fetchedAt !== 'string') {
    return null;
  }
  if (typeof obj.ok !== 'boolean') {
    return null;
  }

  let credits: number | null = null;
  if (obj.credits === null) {
    credits = null;
  } else if (typeof obj.credits === 'number' && Number.isFinite(obj.credits)) {
    credits = obj.credits;
  } else {
    return null;
  }

  const error =
    typeof obj.error === 'string' && obj.error.trim()
      ? obj.error.trim()
      : undefined;

  return {
    userId: obj.userId,
    merchantId: obj.merchantId,
    credits,
    currency: obj.currency,
    fetchedAt: obj.fetchedAt,
    ok: obj.ok,
    error,
  };
}

type WalletSummaryBlockProps = {
  spec: WalletSummarySpec;
};

export const WalletSummaryBlock = memo(function WalletSummaryBlock({
  spec,
}: WalletSummaryBlockProps) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'User', value: spec.userId },
    { label: 'Merchant', value: spec.merchantId },
    {
      label: 'Credits',
      value:
        spec.credits === null ? '—' : `${spec.credits} ${spec.currency}`,
    },
    { label: 'Fetched', value: spec.fetchedAt },
    { label: 'Status', value: spec.ok ? 'ok' : 'error' },
  ];
  if (spec.error) {
    rows.push({ label: 'Error', value: spec.error });
  }

  return (
    <div
      className={`wallet-summary-block${spec.ok ? '' : ' is-error'}`}
      role="group"
      aria-label="Wallet summary"
    >
      <div className="wallet-summary-header">Wallet summary</div>
      <dl className="wallet-summary-grid">
        {rows.map((row) => (
          <div key={row.label} className="wallet-summary-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
});
