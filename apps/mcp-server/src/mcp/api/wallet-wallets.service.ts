import { Injectable } from '@nestjs/common';
import { WalletApiClient } from './wallet-api.client';

export interface WalletRequestBody {
  merchantId: string;
  userId: string;
  credits: number;
  description: string;
}

export interface WalletTransferRequestBody {
  merchantIdSource: string;
  userIdSource: string;
  credits: number;
  merchantIdDestination: string;
  userIdDestination: string;
  descriptionForSource: string;
  descriptionForDestination: string;
}

export interface WalletResetRequestBody {
  merchantId: string;
  userIds: string;
  credits: number;
  description: string;
}

export interface ListWalletLogsQuery {
  merchantId: string;
  userId: string;
  id?: string;
  dateStart?: string;
  dateEnd?: string;
  page?: number;
  pageSize?: number;
  orderBy?: 'date' | 'MerchantId' | 'UserId' | 'logId';
  direction?: string;
}

@Injectable()
export class WalletWalletsService {
  constructor(private readonly client: WalletApiClient) {}

  async updateWallet(body: WalletRequestBody): Promise<unknown> {
    return this.client.request('PUT', '/api/wallet', body);
  }

  async getWallet(userId: string, merchantId: string): Promise<unknown> {
    return this.client.request(
      'GET',
      `/api/wallet/${encodeURIComponent(userId)}/${encodeURIComponent(merchantId)}`,
    );
  }

  async transferCredits(body: WalletTransferRequestBody): Promise<unknown> {
    return this.client.request('PUT', '/api/wallet/transfer', body);
  }

  async resetWallets(body: WalletResetRequestBody): Promise<unknown> {
    return this.client.request('PUT', '/api/wallet/reset', body);
  }

  async listWalletLogs(query: ListWalletLogsQuery): Promise<{
    data: unknown;
    pagination: Record<string, string>;
  }> {
    return this.client.getPaginatedList('/api/wallet/logs', query);
  }

  async getWalletLog(id: number): Promise<unknown> {
    return this.client.request(
      'GET',
      `/api/wallet/logs/${encodeURIComponent(id)}`,
    );
  }
}
