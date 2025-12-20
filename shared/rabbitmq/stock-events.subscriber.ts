import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { LoggerService, PrismaService } from '../index';

/**
 * RabbitMQ subscriber for stock events from warehouse-microservice
 * Updates local offer stock quantities when stock changes
 */
@Injectable()
export class StockEventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly exchangeName = 'stock.events';
  private readonly queueName = 'stock.aukro-service';

  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.connect();
    await this.subscribe();
  }

  async onModuleDestroy() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }

  private async connect() {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@statex_rabbitmq:5672';
      this.logger.log(`Connecting to RabbitMQ: ${url}`, 'StockEventsSubscriber');

      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Assert exchange exists
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });

      // Assert queue exists
      await this.channel.assertQueue(this.queueName, { durable: true });

      // Bind queue to exchange with routing key
      await this.channel.bindQueue(this.queueName, this.exchangeName, 'stock.#');

      this.logger.log('Connected to RabbitMQ and subscribed to stock events', 'StockEventsSubscriber');
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`, error.stack, 'StockEventsSubscriber');
    }
  }

  private async subscribe() {
    if (!this.channel) return;

    try {
      await this.channel.consume(
        this.queueName,
        async (msg) => {
          if (!msg) return;

          try {
            const event = JSON.parse(msg.content.toString());
            await this.handleStockEvent(event);
            this.channel?.ack(msg);
          } catch (error) {
            this.logger.error(`Error processing stock event: ${error.message}`, error.stack, 'StockEventsSubscriber');
            this.channel?.nack(msg, false, false); // Reject and don't requeue
          }
        },
        { noAck: false }
      );

      this.logger.log('Subscribed to stock events queue', 'StockEventsSubscriber');
    } catch (error) {
      this.logger.error(`Failed to subscribe to stock events: ${error.message}`, error.stack, 'StockEventsSubscriber');
    }
  }

  /**
   * Handle stock event from warehouse-microservice
   */
  private async handleStockEvent(event: any) {
    const { type, productId, available } = event;

    this.logger.log(`Received stock event: ${type} for product ${productId}, available: ${available}`, 'StockEventsSubscriber');

    // Update all Allegro offers linked to this product
    // This would typically update the AllegroOffer.stockQuantity field
    // and optionally sync to Allegro API if needed

    switch (type) {
      case 'stock.updated':
        // Update offer stock quantities
        await this.updateOfferStock(productId, available);
        break;
      case 'stock.low':
        // Log warning, optionally send notification
        this.logger.warn(`Low stock alert for product ${productId}: ${available} available`, 'StockEventsSubscriber');
        break;
      case 'stock.out':
        // Mark offers as out of stock, update Allegro API
        await this.handleOutOfStock(productId);
        break;
    }
  }

  /**
   * Update offer stock quantities for a product
   * Note: productId is the catalog-microservice product ID
   * We need to find offers by matching SKU/EAN or by stored catalogProductId
   */
  private async updateOfferStock(productId: string, available: number) {
    try {
      // Find offers linked to this product
      // For now, we'll update offers that have productId matching (legacy) or catalogProductId
      // In the future, we should add catalogProductId field to AllegroOffer
      const offers = await this.prisma.aukroOffer.findMany({
        where: {
          productId: productId,
        },
        select: {
          id: true,
          aukroOfferId: true,
          stockQuantity: true,
          isActive: true,
        },
      });

      if (offers.length === 0) {
        this.logger.log(`No offers found for product ${productId}`, 'StockEventsSubscriber');
        return;
      }

      // Update each offer's stock quantity
      for (const offer of offers) {
        if (offer.stockQuantity !== available) {
          await this.prisma.aukroOffer.update({
            where: { id: offer.id },
            data: {
              stockQuantity: available,
            },
          });

          this.logger.log(
            `Updated offer ${offer.id} (Aukro: ${offer.aukroOfferId}) stock from ${offer.stockQuantity} to ${available}`,
            'StockEventsSubscriber'
          );

          // TODO: Optionally sync to Allegro API if stock changed significantly
          // This could be done via InventoryService or directly via AllegroApiService
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to update offer stock: ${error.message}`, error.stack, 'StockEventsSubscriber');
    }
  }

  /**
   * Handle out of stock event
   */
  private async handleOutOfStock(productId: string) {
    try {
      // Set stock to 0 for all offers
      await this.updateOfferStock(productId, 0);

      // Optionally deactivate offers on Allegro
      // This could be done via OffersService or AllegroApiService
      this.logger.warn(`Product ${productId} is out of stock - offers updated`, 'StockEventsSubscriber');
    } catch (error: any) {
      this.logger.error(`Failed to handle out of stock: ${error.message}`, error.stack, 'StockEventsSubscriber');
    }
  }
}

