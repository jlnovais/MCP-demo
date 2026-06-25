import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WalletApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

const PAGINATION_HEADERS = [
  'x-total-count',
  'x-page',
  'x-page-size',
  'x-total-pages',
  'x-has-next-page',
  'x-has-previous-page',
] as const;

@Injectable()
export class WalletApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('WALLET_API_BASE_URL') ??
      'http://localhost:3000';
    this.apiKey = this.configService.get<string>('WALLET_API_KEY') ?? '';
  }

  buildQueryParams(query: object): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    return params;
  }

  extractPaginationHeaders(response: Response): Record<string, string> {
    const pagination: Record<string, string> = {};
    for (const header of PAGINATION_HEADERS) {
      const value = response.headers.get(header);
      if (value) {
        pagination[header] = value;
      }
    }
    return pagination;
  }

  async getPaginatedList(
    path: string,
    query: object,
  ): Promise<{ data: unknown; pagination: Record<string, string> }> {
    const params = this.buildQueryParams(query);
    const response = await this.rawRequest(
      'GET',
      `${path}?${params.toString()}`,
    );

    return {
      data: await response.json(),
      pagination: this.extractPaginationHeaders(response),
    };
  }

  async request(
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

  async rawRequest(
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
