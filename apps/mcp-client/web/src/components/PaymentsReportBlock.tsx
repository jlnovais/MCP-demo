import { memo } from 'react';
import './PaymentsReportBlock.css';

export type PaymentsReportSpec = {
  requestDateStart: string;
  requestDateEnd: string;
  merchantId: string;
  userId: string;
  totalCount: number;
  byType: Array<{
    type: string;
    count: number;
    amountSum: number;
    creditsSum: number;
  }>;
  byStatus: Array<{ status: string; count: number }>;
  amountTotal: number;
  creditsTotal: number;
  truncated: boolean;
  ok: boolean;
  error?: string;
};

function isByTypeRow(
  value: unknown,
): value is PaymentsReportSpec['byType'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.type === 'string' &&
    typeof row.count === 'number' &&
    Number.isFinite(row.count) &&
    typeof row.amountSum === 'number' &&
    Number.isFinite(row.amountSum) &&
    typeof row.creditsSum === 'number' &&
    Number.isFinite(row.creditsSum)
  );
}

function isByStatusRow(
  value: unknown,
): value is PaymentsReportSpec['byStatus'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.status === 'string' &&
    typeof row.count === 'number' &&
    Number.isFinite(row.count)
  );
}

export function parsePaymentsReportSpec(
  raw: string,
): PaymentsReportSpec | null {
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
  if (
    typeof obj.requestDateStart !== 'string' ||
    typeof obj.requestDateEnd !== 'string' ||
    typeof obj.merchantId !== 'string' ||
    typeof obj.userId !== 'string'
  ) {
    return null;
  }
  if (
    typeof obj.totalCount !== 'number' ||
    !Number.isFinite(obj.totalCount) ||
    typeof obj.amountTotal !== 'number' ||
    !Number.isFinite(obj.amountTotal) ||
    typeof obj.creditsTotal !== 'number' ||
    !Number.isFinite(obj.creditsTotal) ||
    typeof obj.truncated !== 'boolean' ||
    typeof obj.ok !== 'boolean'
  ) {
    return null;
  }
  if (!Array.isArray(obj.byType) || !obj.byType.every(isByTypeRow)) {
    return null;
  }
  if (!Array.isArray(obj.byStatus) || !obj.byStatus.every(isByStatusRow)) {
    return null;
  }

  const error =
    typeof obj.error === 'string' && obj.error.trim()
      ? obj.error.trim()
      : undefined;

  return {
    requestDateStart: obj.requestDateStart,
    requestDateEnd: obj.requestDateEnd,
    merchantId: obj.merchantId,
    userId: obj.userId,
    totalCount: obj.totalCount,
    byType: obj.byType,
    byStatus: obj.byStatus,
    amountTotal: obj.amountTotal,
    creditsTotal: obj.creditsTotal,
    truncated: obj.truncated,
    ok: obj.ok,
    error,
  };
}

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

type PaymentsReportBlockProps = {
  spec: PaymentsReportSpec;
};

export const PaymentsReportBlock = memo(function PaymentsReportBlock({
  spec,
}: PaymentsReportBlockProps) {
  const merchantLabel = spec.merchantId.trim() === '' ? 'all' : spec.merchantId;
  const userLabel = spec.userId.trim() === '' ? 'all' : spec.userId;

  return (
    <div
      className={`payments-report-block${spec.ok ? '' : ' is-error'}`}
      role="group"
      aria-label="Payments report"
    >
      <div className="payments-report-header">Payments report</div>
      <dl className="payments-report-meta">
        <div className="payments-report-row">
          <dt>Range</dt>
          <dd>
            {spec.requestDateStart} → {spec.requestDateEnd}
          </dd>
        </div>
        <div className="payments-report-row">
          <dt>Merchant</dt>
          <dd>{merchantLabel}</dd>
        </div>
        <div className="payments-report-row">
          <dt>User</dt>
          <dd>{userLabel}</dd>
        </div>
        <div className="payments-report-row">
          <dt>Total</dt>
          <dd>{spec.totalCount}</dd>
        </div>
        <div className="payments-report-row">
          <dt>Amount</dt>
          <dd>€{formatMoney(spec.amountTotal)}</dd>
        </div>
        <div className="payments-report-row">
          <dt>Credits</dt>
          <dd>{formatMoney(spec.creditsTotal)}</dd>
        </div>
        {spec.truncated ? (
          <div className="payments-report-row">
            <dt>Note</dt>
            <dd>Truncated (page cap reached)</dd>
          </div>
        ) : null}
        {spec.error ? (
          <div className="payments-report-row">
            <dt>Error</dt>
            <dd>{spec.error}</dd>
          </div>
        ) : null}
      </dl>

      {spec.byType.length > 0 ? (
        <table className="payments-report-table">
          <caption>By type</caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Count</th>
              <th scope="col">Amount</th>
              <th scope="col">Credits</th>
            </tr>
          </thead>
          <tbody>
            {spec.byType.map((row) => (
              <tr key={row.type}>
                <td>{row.type}</td>
                <td>{row.count}</td>
                <td>€{formatMoney(row.amountSum)}</td>
                <td>{formatMoney(row.creditsSum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {spec.byStatus.length > 0 ? (
        <ul className="payments-report-status">
          {spec.byStatus.map((row) => (
            <li key={row.status}>
              <span>{row.status}</span>
              <span>{row.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
