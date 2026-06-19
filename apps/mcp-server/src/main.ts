import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 4000);
  console.log(`MCP server is running on port ${port}`);
  console.log(`MCP endpoint: POST http://localhost:${port}/mcp/v1`);

  await app.listen(port);
}

bootstrap();
