/**
 * Aukro Module
 */

import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module';
import { OffersModule } from './offers/offers.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [AccountsModule, OffersModule, OrdersModule],
})
export class AukroModule {}

