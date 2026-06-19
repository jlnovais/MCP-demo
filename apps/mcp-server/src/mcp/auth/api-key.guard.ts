import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expectedKey = this.configService.get<string>('MCP_SERVER_API_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('MCP API key is not configured');
    }

    const providedKey =
      request.header('x-api-key') ??
      request.header('authorization')?.replace(/^Bearer\s+/i, '');

    if (!providedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
