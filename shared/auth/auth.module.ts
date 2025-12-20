/**
 * Auth Module
 * Provides AuthService for authentication via auth-microservice
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoggerModule } from '../logger/logger.module';
import { ResilienceModule } from '../resilience/resilience.module';

@Module({
  imports: [
    ConfigModule, // ConfigModule is already global in AppModule, just import it here for type safety
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    LoggerModule,
    ResilienceModule,
  ],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {
  // ConfigService is available globally via ConfigModule in AppModule
  // JwtAuthGuard uses ConfigService to get JWT_SECRET from environment
}

