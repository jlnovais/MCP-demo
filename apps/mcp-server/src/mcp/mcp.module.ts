import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './auth/api-key.guard';
import { WalletPaymentsService } from './api/wallet-payments.service';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  controllers: [McpController],
  providers: [McpService, WalletPaymentsService, ApiKeyGuard],
})
export class McpModule {}
