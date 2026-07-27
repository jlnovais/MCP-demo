import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './auth/api-key.guard';
import { WalletApiClient } from './api/wallet-api.client';
import { WalletExchangeRateService } from './api/wallet-exchange-rate.service';
import { WalletPaymentsService } from './api/wallet-payments.service';
import { WalletWalletsService } from './api/wallet-wallets.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { LanceDbVectorStore } from './knowledge/lancedb-vector-store';
import { PostgresVectorStore } from './knowledge/postgres-vector-store';
import { KNOWLEDGE_VECTOR_STORE } from './knowledge/vector-store.interface';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { UtilitiesDatesService } from './utilities/utilities-dates.service';

@Module({
  controllers: [McpController],
  providers: [
    McpService,
    WalletApiClient,
    WalletPaymentsService,
    WalletWalletsService,
    WalletExchangeRateService,
    ApiKeyGuard,
    UtilitiesDatesService,
    {
      provide: KNOWLEDGE_VECTOR_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const backend = (
          config.get<string>('VECTOR_STORE') ?? 'postgres'
        ).toLowerCase();
        if (backend === 'lancedb') {
          return new LanceDbVectorStore(config);
        }
        if (backend !== 'postgres') {
          throw new Error(
            `Unsupported VECTOR_STORE="${backend}". Use "postgres" or "lancedb".`,
          );
        }
        return new PostgresVectorStore(config);
      },
    },
    KnowledgeService,
  ],
})
export class McpModule {}
