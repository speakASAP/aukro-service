import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '@aukro/shared';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getOrders(@Param() params: any) {
    return this.ordersService.findAll(params);
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  async createOrder(@Body() data: any) {
    return this.ordersService.create(data);
  }

  @Post('webhook')
  async webhook(@Body() data: any) {
    return this.ordersService.handleWebhook(data);
  }
}

