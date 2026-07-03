import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './auth/api-key.guard';
import { WalletApiClient } from './api/wallet-api.client';
import { WalletExchangeRateService } from './api/wallet-exchange-rate.service';
import { WalletPaymentsService } from './api/wallet-payments.service';
import { WalletWalletsService } from './api/wallet-wallets.service';
import { KnowledgeService } from './knowledge/knowledge.service';
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
    KnowledgeService,
  ],
})
export class McpModule {}
