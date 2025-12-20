import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '@aukro/shared';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async getAccounts() {
    return this.accountsService.findAll();
  }

  @Get(':id')
  async getAccount(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Post()
  async createAccount(@Body() data: any) {
    return this.accountsService.create(data);
  }

  @Put(':id')
  async updateAccount(@Param('id') id: string, @Body() data: any) {
    return this.accountsService.update(id, data);
  }

  @Delete(':id')
  async deleteAccount(@Param('id') id: string) {
    return this.accountsService.delete(id);
  }
}

