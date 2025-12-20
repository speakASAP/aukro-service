import { Injectable } from '@nestjs/common';
import { PrismaService, LoggerService, CatalogClientService, WarehouseClientService } from '@aukro/shared';

@Injectable()
export class OffersService {
  private readonly logger: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogClient: CatalogClientService,
    private readonly warehouseClient: WarehouseClientService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;
    this.logger.setContext('OffersService');
  }

  async findAll(query: any) {
    return this.prisma.aukroOffer.findMany({
      where: {
        isActive: query.isActive !== undefined ? query.isActive === 'true' : undefined,
        accountId: query.accountId,
      },
      include: {
        account: true,
      },
    });
  }

  async findOne(id: string) {
    const offer = await this.prisma.aukroOffer.findUnique({
      where: { id },
      include: { account: true },
    });

    if (offer && offer.productId) {
      try {
        const product = await this.catalogClient.getProductById(offer.productId);
        const stock = await this.warehouseClient.getTotalAvailable(offer.productId);
        return {
          ...offer,
          product,
          stock,
        };
      } catch (error: any) {
        this.logger.warn(`Failed to fetch product data for offer ${id}: ${error.message}`);
      }
    }

    return offer;
  }

  async create(data: any) {
    return this.prisma.aukroOffer.create({
      data,
    });
  }

  async update(id: string, data: any) {
    return this.prisma.aukroOffer.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.aukroOffer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async syncFromCatalog(data?: any) {
    // TODO: Implement sync from catalog-microservice to create/update Aukro offers
    this.logger.log('Sync from catalog not yet implemented');
    return { message: 'Sync from catalog not yet implemented' };
  }
}

