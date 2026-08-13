import type {
  ListPaymentsQuery,
  WalletPaymentsService,
} from '../api/wallet-payments.service';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 50;

export type PaymentsReportByType = {
  type: string;
  count: number;
  amountSum: number;
  creditsSum: number;
};

export type PaymentsReportByStatus = {
  status: string;
  count: number;
};

export type PaymentsReport = {
  requestDateStart: string;
  requestDateEnd: string;
  merchantId: string;
  userId: string;
  totalCount: number;
  byType: PaymentsReportByType[];
  byStatus: PaymentsReportByStatus[];
  amountTotal: number;
  creditsTotal: number;
  truncated: boolean;
  ok: boolean;
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const record = asRecord(value);
  if (!record) {
    return [];
  }
  for (const key of ['data', 'items', 'results', 'payments']) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }
  return [];
}

function pickNumber(
  record: Record<string, unknown> | undefined,
  keys: string[],
): number {
  if (!record) {
    return 0;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

function pickString(
  record: Record<string, unknown> | undefined,
  keys: string[],
  fallback: string,
): string {
  if (!record) {
    return fallback;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return fallback;
}

function hasNextPage(
  pagination: Record<string, string>,
  page: number,
): boolean {
  const hasNext = pagination['x-has-next-page']?.toLowerCase();
  if (hasNext === 'true') {
    return true;
  }
  if (hasNext === 'false') {
    return false;
  }
  const totalPages = Number(pagination['x-total-pages']);
  if (Number.isFinite(totalPages) && totalPages > 0) {
    return page < totalPages;
  }
  return false;
}

function emptyReport(
  args: {
    requestDateStart: string;
    requestDateEnd: string;
    merchantId: string;
    userId: string;
  },
  error?: string,
): PaymentsReport {
  return {
    requestDateStart: args.requestDateStart,
    requestDateEnd: args.requestDateEnd,
    merchantId: args.merchantId,
    userId: args.userId,
    totalCount: 0,
    byType: [],
    byStatus: [],
    amountTotal: 0,
    creditsTotal: 0,
    truncated: false,
    ok: error === undefined,
    error,
  };
}

/**
 * Page through list_payments and aggregate into a fixed report schema.
 * Used by Structured mode for payment summaries — not for RAG.
 */
export async function buildPaymentsReport(
  paymentsService: WalletPaymentsService,
  args: {
    requestDateStart: string;
    requestDateEnd: string;
    merchantId?: string;
    userId?: string;
  },
): Promise<PaymentsReport> {
  const merchantId = args.merchantId ?? '';
  const userId = args.userId ?? '';
  const base = {
    requestDateStart: args.requestDateStart,
    requestDateEnd: args.requestDateEnd,
    merchantId,
    userId,
  };

  const byTypeMap = new Map<
    string,
    { count: number; amountSum: number; creditsSum: number }
  >();
  const byStatusMap = new Map<string, number>();
  let amountTotal = 0;
  let creditsTotal = 0;
  let totalCount = 0;
  let truncated = false;

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const query: ListPaymentsQuery = {
        merchantId,
        userId: userId || undefined,
        requestDateStart: args.requestDateStart,
        requestDateEnd: args.requestDateEnd,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        orderBy: 'requestDate',
        direction: 'DESC',
      };

      const { data, pagination } = await paymentsService.listPayments(query);
      const rows = asArray(data);

      for (const row of rows) {
        const record = asRecord(row);
        const type = pickString(
          record,
          ['type', 'Type', 'paymentType'],
          'UNKNOWN',
        );
        const status = pickString(
          record,
          ['status', 'Status', 'paymentStatus'],
          'UNKNOWN',
        );
        const amount = pickNumber(record, [
          'amount',
          'Amount',
          'value',
          'Value',
        ]);
        const credits = pickNumber(record, ['credits', 'Credits']);

        totalCount += 1;
        amountTotal += amount;
        creditsTotal += credits;

        const typeEntry = byTypeMap.get(type) ?? {
          count: 0,
          amountSum: 0,
          creditsSum: 0,
        };
        typeEntry.count += 1;
        typeEntry.amountSum += amount;
        typeEntry.creditsSum += credits;
        byTypeMap.set(type, typeEntry);

        byStatusMap.set(status, (byStatusMap.get(status) ?? 0) + 1);
      }

      if (rows.length === 0) {
        break;
      }
      if (!hasNextPage(pagination, page)) {
        break;
      }
      if (page === MAX_PAGES) {
        truncated = true;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyReport(base, message);
  }

  const byType: PaymentsReportByType[] = [...byTypeMap.entries()]
    .map(([type, stats]) => ({ type, ...stats }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const byStatus: PaymentsReportByStatus[] = [...byStatusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));

  return {
    ...base,
    totalCount,
    byType,
    byStatus,
    amountTotal,
    creditsTotal,
    truncated,
    ok: true,
  };
}
