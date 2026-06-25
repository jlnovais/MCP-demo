import { Injectable } from '@nestjs/common';
import { WalletApiClient } from './wallet-api.client';

export interface CreateExchangeRateBody {
  merchantId: string;
  amount: number;
}

@Injectable()
export class WalletExchangeRateService {
  constructor(private readonly client: WalletApiClient) {}

  async upsertExchangeRate(body: CreateExchangeRateBody): Promise<unknown> {
    return this.client.request('POST', '/api/exchange-rate', body);
  }

  async getExchangeRate(merchantId: string): Promise<unknown> {
    return this.client.request(
      'GET',
      `/api/exchange-rate/${encodeURIComponent(merchantId)}`,
    );
  }
}
