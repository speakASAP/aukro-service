import { Injectable } from '@nestjs/common';
import { PrismaService, LoggerService } from '@aukro/shared';

@Injectable()
export class AccountsService {
  private readonly logger: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;
    this.logger.setContext('AccountsService');
  }

  async findAll() {
    return this.prisma.aukroAccount.findMany({
      where: { isActive: true },
    });
  }

  async findOne(id: string) {
    return this.prisma.aukroAccount.findUnique({
      where: { id },
    });
  }

  async create(data: any) {
    return this.prisma.aukroAccount.create({
      data,
    });
  }

  async update(id: string, data: any) {
    return this.prisma.aukroAccount.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.aukroAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

