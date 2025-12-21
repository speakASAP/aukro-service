import { Injectable } from '@nestjs/common';
import { PrismaService, LoggerService, OrderClientService } from '@aukro/shared';

@Injectable()
export class OrdersService {
  private readonly logger: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderClient: OrderClientService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;
    this.logger.setContext('OrdersService');
  }

  async findAll(query: any) {
    return this.prisma.aukroOrder.findMany({
      where: {
        accountId: query.accountId,
        status: query.status,
        forwarded: query.forwarded !== undefined ? query.forwarded === 'true' : undefined,
      },
      include: {
        account: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.aukroOrder.findUnique({
      where: { id },
      include: { account: true },
    });
  }

  async create(data: any) {
    const order = await this.prisma.aukroOrder.create({
      data,
    });

    // Forward to orders-microservice
    try {
      // Parse items from rawData if available
      let items: any[] = [];
      if (order.rawData && typeof order.rawData === 'object') {
        const rawData = order.rawData as any;
        if (Array.isArray(rawData.items)) {
          items = rawData.items.map((item: any) => ({
            productId: item.productId || null,
            sku: item.sku || null,
            title: item.title || item.name || 'Unknown',
            quantity: item.quantity || 1,
            unitPrice: parseFloat(item.price || item.unitPrice || '0'),
            totalPrice: parseFloat(item.totalPrice || (item.price || item.unitPrice || '0') * (item.quantity || 1)),
          }));
        }
      }

      const centralOrder = await this.orderClient.createOrder({
        externalOrderId: order.aukroOrderId,
        channel: 'aukro',
        channelAccountId: order.accountId,
        customer: {
          email: order.customerEmail,
          phone: order.customerPhone,
        },
        items,
        subtotal: Number(order.total),
        shippingCost: 0,
        taxAmount: 0,
        total: Number(order.total),
        currency: order.currency,
        orderedAt: order.createdAt,
      });

      await this.prisma.aukroOrder.update({
        where: { id: order.id },
        data: {
          orderId: centralOrder.id,
          forwarded: true,
        },
      });

      this.logger.log(`Order ${order.id} forwarded to orders-microservice: ${centralOrder.id}`);
    } catch (error: any) {
      this.logger.error(`Failed to forward order to orders-microservice: ${error.message}`);
    }

    return order;
  }

  async handleWebhook(data: any) {
    try {
      this.logger.log('Received Aukro webhook', { data });

      // Parse webhook data (format depends on Aukro API)
      // This is a generic implementation - adjust based on actual Aukro webhook format
      const {
        orderId: aukroOrderId,
        accountId,
        customerEmail,
        customerPhone,
        items = [],
        total,
        currency = 'CZK',
        status = 'pending',
      } = data;

      if (!aukroOrderId) {
        throw new Error('orderId is required in webhook data');
      }

      // Check if order already exists
      const existingOrder = await this.prisma.aukroOrder.findUnique({
        where: { aukroOrderId },
      });

      if (existingOrder) {
        this.logger.log(`Order ${aukroOrderId} already exists, updating status`);
        // Update order status if changed
        if (existingOrder.status !== status) {
          await this.prisma.aukroOrder.update({
            where: { id: existingOrder.id },
            data: { status, updatedAt: new Date() },
          });
        }
        return existingOrder;
      }

      // Find account if accountId not provided
      let finalAccountId = accountId;
      if (!finalAccountId) {
        // Try to find active account (if only one account)
        const accounts = await this.prisma.aukroAccount.findMany({
          where: { isActive: true },
        });
        if (accounts.length === 1) {
          finalAccountId = accounts[0].id;
        } else {
          throw new Error('accountId is required when multiple accounts exist');
        }
      }

      // Create order
      const order = await this.create({
        accountId: finalAccountId,
        aukroOrderId,
        customerEmail,
        customerPhone,
        total: parseFloat(total) || 0,
        currency,
        status,
        rawData: data,
      });

      this.logger.log(`Order created from webhook: ${order.id}`);
      return order;
    } catch (error: any) {
      this.logger.error(`Failed to handle webhook: ${error.message}`, error.stack);
      throw error;
    }
  }
}

