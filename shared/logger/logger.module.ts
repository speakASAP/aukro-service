/**
 * Logger Module
 * Provides centralized logging service for NestJS services
 * 
 * This module is a CLIENT/WRAPPER for the external logging microservice.
 * It sends logs to the centralized logging service at:
 * - Production: https://logging.statex.cz
 * - Docker network: http://logging-microservice:${PORT:-3367} (port configured in logging-microservice/.env)
 * 
 * Logs are also written locally as a backup.
 */

import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}

