/**
 * API Gateway App Module
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { GatewayModule } from './gateway/gateway.module';
import { PrismaModule, LoggerModule, AuthModule, HealthModule } from '@aukro/shared';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    LoggerModule,
    AuthModule,
    HealthModule,
    GatewayModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

