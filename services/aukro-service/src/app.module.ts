/**
 * Aukro Service App Module
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AukroModule } from './aukro/aukro.module';
import { PrismaModule, LoggerModule, HealthModule, RabbitMQModule } from '@aukro/shared';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    LoggerModule,
    HealthModule,
    RabbitMQModule,
    AukroModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

