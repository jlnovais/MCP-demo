import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

export interface WalletApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

@Injectable()
export class WalletPaymentsService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('WALLET_API_BASE_URL') ??
      'http://localhost:3000';
    this.apiKey = this.configService.get<string>('WALLET_API_KEY') ?? '';
  }

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

    return this.request('POST', path, body);
  }

  async listPayments(query: ListPaymentsQuery): Promise<{
    data: unknown;
    pagination: Record<string, string>;
  }> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }

    const response = await this.rawRequest(
      'GET',
      `/api/payments?${params.toString()}`,
    );

    const pagination: Record<string, string> = {};
    for (const header of [
      'x-total-count',
      'x-page',
      'x-page-size',
      'x-total-pages',
      'x-has-next-page',
      'x-has-previous-page',
    ]) {
      const value = response.headers.get(header);
      if (value) {
        pagination[header] = value;
      }
    }

    return { data: await response.json(), pagination };
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

    return this.request('GET', path);
  }

  async cancelPayment(id: string): Promise<unknown> {
    return this.request(
      'DELETE',
      `/api/payments/${encodeURIComponent(id)}/cancel`,
    );
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const response = await this.rawRequest(method, path, body);
    const text = await response.text();

    let payload: unknown = text;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const error = payload as WalletApiError;
      const message =
        typeof error?.message === 'string'
          ? error.message
          : Array.isArray(error?.message)
            ? error.message.join(', ')
            : `Wallet API request failed with status ${response.status}`;

      throw new Error(message);
    }

    return payload;
  }

  private async rawRequest(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    if (!this.apiKey) {
      throw new Error('WALLET_API_KEY is not configured');
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'x-wallet-api-key': this.apiKey,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(new URL(path, this.baseUrl), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }
}
