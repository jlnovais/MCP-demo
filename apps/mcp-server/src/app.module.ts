import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/validate-env';
import { McpModule } from './mcp/mcp.module';
import path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), 'apps', 'mcp-server', '.env'),
      ],
    }),
    McpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
