import { Injectable } from '@nestjs/common';
import { WalletApiClient } from './wallet-api.client';

export interface PaymentRequestBody {
  merchantId?: string;
  userId: string;
  amount: number;
  credits: number;
  expirationMinutes: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  description: string;
  type: 'MB' | 'MBWAY' | 'CARD';
}

export interface ListPaymentsQuery {
  merchantId: string;
  id?: string;
  userId?: string;
  status?:
    | 'NEW'
    | 'ERROR'
    | 'UPDATE'
    | 'PAID'
    | 'REFUSED'
    | 'REFUNDED'
    | 'UNKNOWN'
    | 'CANCELED';
  reference?: string;
  customerPhone?: string;
  requestDateStart?: string;
  requestDateEnd?: string;
  type?: 'MB' | 'MBWAY' | 'CARD';
  page?: number;
  pageSize?: number;
  orderBy?: string;
  direction?: string;
}

@Injectable()
export class WalletPaymentsService {
  constructor(private readonly client: WalletApiClient) {}

  async createPayment(
    body: PaymentRequestBody,
    options?: { inApp?: boolean; isAuthorization?: boolean },
  ): Promise<unknown> {
    const params = new URLSearchParams();
    if (options?.inApp !== undefined) {
      params.set('inApp', String(options.inApp));
    }
    if (options?.isAuthorization !== undefined) {
      params.set('isAuthorization', String(options.isAuthorization));
    }

    const query = params.toString();
    const path = query ? `/api/payments?${query}` : '/api/payments';

    return this.client.request('POST', path, body);
  }

  async listPayments(query: ListPaymentsQuery): Promise<{
    data: unknown;
    pagination: Record<string, string>;
  }> {
    return this.client.getPaginatedList('/api/payments', query);
  }

  async getPayment(id: string, checkProvider?: boolean): Promise<unknown> {
    const params = new URLSearchParams();
    if (checkProvider !== undefined) {
      params.set('checkProvider', String(checkProvider));
    }

    const query = params.toString();
    const path = query
      ? `/api/payments/${encodeURIComponent(id)}?${query}`
      : `/api/payments/${encodeURIComponent(id)}`;

    return this.client.request('GET', path);
  }

  async cancelPayment(id: string): Promise<unknown> {
    return this.client.request(
      'DELETE',
      `/api/payments/${encodeURIComponent(id)}/cancel`,
    );
  }
}
