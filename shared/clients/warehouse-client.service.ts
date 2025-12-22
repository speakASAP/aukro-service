import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '../logger/logger.service';

/**
 * API client for warehouse-microservice
 * Fetches stock levels and manages stock reservations
 */
@Injectable()
export class WarehouseClientService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {
    this.baseUrl = process.env.WAREHOUSE_SERVICE_URL || 'http://warehouse-microservice:3201';
  }

  /**
   * Get stock for a product across all warehouses
   */
  async getStockByProduct(productId: string): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/api/stock/${productId}`)
      );
      return response.data.data || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Stock not found for product ${productId}: ${errorMessage}`, 'WarehouseClient');
      return [];
    }
  }

  /**
   * Get total available stock for a product
   */
  async getTotalAvailable(productId: string): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/api/stock/${productId}/total`)
      );
      return response.data.data?.totalAvailable || 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to get total stock for product ${productId}: ${errorMessage}`, 'WarehouseClient');
      return 0;
    }
  }

  /**
   * Reserve stock for an order
   */
  async reserveStock(productId: string, warehouseId: string, quantity: number, orderId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/api/stock/reserve`, {
          productId,
          warehouseId,
          quantity,
          orderId,
        })
      );
      return response.data.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to reserve stock: ${errorMessage}`, errorStack, 'WarehouseClient');
      throw new HttpException(`Failed to reserve stock: ${errorMessage}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Release reserved stock
   */
  async unreserveStock(productId: string, warehouseId: string, quantity: number, orderId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/api/stock/unreserve`, {
          productId,
          warehouseId,
          quantity,
          orderId,
        })
      );
      return response.data.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to unreserve stock: ${errorMessage}`, errorStack, 'WarehouseClient');
      throw new HttpException(`Failed to unreserve stock: ${errorMessage}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Decrement stock (after order shipped)
   */
  async decrementStock(productId: string, warehouseId: string, quantity: number, reason?: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/api/stock/decrement`, {
          productId,
          warehouseId,
          quantity,
          reason: reason || 'Order shipped',
        })
      );
      return response.data.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to decrement stock: ${errorMessage}`, errorStack, 'WarehouseClient');
      throw new HttpException(`Failed to decrement stock: ${errorMessage}`, HttpStatus.BAD_REQUEST);
    }
  }
}

