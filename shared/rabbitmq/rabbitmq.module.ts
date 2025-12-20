import { Module } from '@nestjs/common';
import { StockEventsSubscriber } from './stock-events.subscriber';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [LoggerModule, PrismaModule],
  providers: [StockEventsSubscriber],
  exports: [StockEventsSubscriber],
})
export class RabbitMQModule {}

