import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CatalogClientService } from './catalog-client.service';
import { WarehouseClientService } from './warehouse-client.service';
import { OrderClientService } from './order-client.service';
import { LoggerModule } from '../logger/logger.module';

@Global()
@Module({
  imports: [HttpModule, LoggerModule],
  providers: [CatalogClientService, WarehouseClientService, OrderClientService],
  exports: [CatalogClientService, WarehouseClientService, OrderClientService],
})
export class ClientsModule {}

