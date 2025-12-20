import { Controller, Get } from '@nestjs/common';
import { HealthService } from '@aukro/shared';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    return this.healthService.getHealthStatus('api-gateway');
  }
}

