import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiKeyGuard } from './auth/api-key.guard';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post('v1')
  @UseGuards(ApiKeyGuard)
  async handleMcpRequest(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    await this.mcpService.handleRequest(req, res);
  }
}
