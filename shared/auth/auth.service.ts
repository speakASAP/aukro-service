/**
 * Auth Service
 * Service to handle authentication via auth-microservice
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  RegisterDto,
  LoginDto,
  AuthResponse,
  ValidateTokenResponse,
  RefreshTokenDto,
  AuthUser,
} from './auth.interface';
import { LoggerService } from '../logger/logger.service';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { RetryService } from '../resilience/retry.service';
import { ResilienceMonitor } from '../resilience/resilience.monitor';

@Injectable()
export class AuthService {
  private readonly authServiceUrl: string;
  private readonly logger: LoggerService;
  private readonly circuitBreakerService: CircuitBreakerService;
  private readonly retryService: RetryService;
  private readonly resilienceMonitor: ResilienceMonitor;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    logger: LoggerService,
    circuitBreakerService: CircuitBreakerService,
    retryService: RetryService,
    resilienceMonitor: ResilienceMonitor,
  ) {
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') || this.throwConfigError('AUTH_SERVICE_URL');
    this.logger = logger;
    this.circuitBreakerService = circuitBreakerService;
    this.retryService = retryService;
    this.resilienceMonitor = resilienceMonitor;
  }

  /**
   * Internal method to call auth-microservice via HTTP
   */
  private async callAuthService<T>(
    endpoint: string,
    data?: any,
  ): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.post<T>(
        `${this.authServiceUrl}${endpoint}`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: parseInt(this.configService.get<string>('AUTH_SERVICE_TIMEOUT') || this.configService.get<string>('HTTP_TIMEOUT') || '10000'),
        },
      ),
    );
    return response.data;
  }

  /**
   * Register a new user
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const callFn = async () => this.callAuthService<AuthResponse>('/auth/register', dto);

    try {
      const response = await this.retryService.retry(
        callFn,
        3,
        1000,
      );

      this.resilienceMonitor.recordCall('auth-microservice', true);

      this.logger.log(`User registered successfully`, {
        email: dto.email,
        userId: response?.user?.id,
      });

      return response as AuthResponse;
    } catch (error: any) {
      this.resilienceMonitor.recordCall('auth-microservice', false);

      this.logger.error('Failed to register user', {
        error: error.message,
        email: dto.email,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Login user
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const callFn = async () => this.callAuthService<AuthResponse>('/auth/login', dto);

    try {
      const response = await this.retryService.retry(
        callFn,
        3,
        1000,
      );

      this.resilienceMonitor.recordCall('auth-microservice', true);

      this.logger.log(`User logged in successfully`, {
        email: dto.email,
        userId: response?.user?.id,
      });

      return response as AuthResponse;
    } catch (error: any) {
      this.resilienceMonitor.recordCall('auth-microservice', false);

      this.logger.error('Failed to login user', {
        error: error.message,
        email: dto.email,
      });

      if (error.response?.status === 401) {
        throw new UnauthorizedException('Invalid credentials');
      }

      throw error;
    }
  }

  /**
   * Validate JWT token
   * Uses reasonable timeout and retries to handle network latency and service load
   */
  async validateToken(token: string): Promise<ValidateTokenResponse> {
    // Use AUTH_VALIDATE_TIMEOUT if set, otherwise fall back to AUTH_SERVICE_TIMEOUT or HTTP_TIMEOUT, default to 10 seconds
    const validationTimeout = parseInt(
      this.configService.get<string>('AUTH_VALIDATE_TIMEOUT') ||
      this.configService.get<string>('AUTH_SERVICE_TIMEOUT') ||
      this.configService.get<string>('HTTP_TIMEOUT') ||
      '10000'
    );
    const callFn = async () => {
      const response = await firstValueFrom(
        this.httpService.post<ValidateTokenResponse>(
          `${this.authServiceUrl}/auth/validate`,
          { token },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: validationTimeout,
          },
        ),
      );
      return response.data;
    };

    try {
      // Use 2 retries with exponential backoff to handle transient network issues
      const maxRetries = 2;
      const retryDelay = 500; // 500ms initial delay
      const response = await this.retryService.retry(
        callFn,
        maxRetries,
        retryDelay,
      );

      this.resilienceMonitor.recordCall('auth-microservice', true);
      return response as ValidateTokenResponse;
    } catch (error: any) {
      this.resilienceMonitor.recordCall('auth-microservice', false);

      // Log the actual error to help debug token validation issues
      this.logger.error('Failed to validate token', {
        error: error.message,
        errorCode: error.code,
        errorStatus: error.response?.status,
        errorResponseData: error.response?.data,
        timeout: error.code === 'ECONNABORTED' || error.message?.includes('timeout'),
        validationTimeout,
        authServiceUrl: this.authServiceUrl,
        stack: error.stack,
      });

      // Return invalid token response
      return { valid: false };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(dto: RefreshTokenDto): Promise<AuthResponse> {
    const callFn = async () => this.callAuthService<AuthResponse>('/auth/refresh', dto);

    try {
      const maxRetries = parseInt(this.configService.get<string>('AUTH_RETRY_MAX_ATTEMPTS') || this.configService.get<string>('RETRY_MAX_ATTEMPTS') || '2');
      const retryDelay = parseInt(this.configService.get<string>('AUTH_RETRY_DELAY_MS') || this.configService.get<string>('RETRY_DELAY_MS') || '500');
      const response = await this.retryService.retry(
        callFn,
        maxRetries,
        retryDelay,
      );

      this.resilienceMonitor.recordCall('auth-microservice', true);
      return response as AuthResponse;
    } catch (error: any) {
      this.resilienceMonitor.recordCall('auth-microservice', false);

      this.logger.error('Failed to refresh token', {
        error: error.message,
      });

      throw new UnauthorizedException('Failed to refresh token');
    }
  }

  private throwConfigError(key: string): never {
    throw new Error(`Missing required environment variable: ${key}. Please set it in your .env file.`);
  }
}

