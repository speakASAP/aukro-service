/**
 * Health Service
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  async getHealthStatus(serviceName: string) {
    return {
      status: 'ok',
      service: serviceName,
      timestamp: new Date().toISOString(),
    };
  }
}

