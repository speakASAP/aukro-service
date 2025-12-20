import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '@aukro/shared';

@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  async getOffers(@Query() query: any) {
    return this.offersService.findAll(query);
  }

  @Get(':id')
  async getOffer(@Param('id') id: string) {
    return this.offersService.findOne(id);
  }

  @Post()
  async createOffer(@Body() data: any) {
    return this.offersService.create(data);
  }

  @Post('sync')
  async syncOffers(@Body() data?: any) {
    return this.offersService.syncFromCatalog(data);
  }

  @Put(':id')
  async updateOffer(@Param('id') id: string, @Body() data: any) {
    return this.offersService.update(id, data);
  }

  @Delete(':id')
  async deleteOffer(@Param('id') id: string) {
    return this.offersService.delete(id);
  }
}

