/**
 * Gateway Controller
 * Routes all API requests to appropriate microservices
 */

import {
  Controller,
  All,
  Get,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { JwtAuthGuard, LoggerService } from '@aukro/shared';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';

@Controller('api')
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);
  private readonly sharedLogger: LoggerService;

  constructor(
    private readonly gatewayService: GatewayService,
    loggerService: LoggerService,
  ) {
    this.sharedLogger = loggerService;
    this.sharedLogger.setContext('GatewayController');
  }

  /**
   * Route OAuth callback (public, no auth required)
   * This endpoint returns a redirect, so we need to handle it specially
   */
  @Get('aukro/oauth/callback')
  async aukroOAuthCallback(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    const path = req.url.replace('/api/aukro', '');
    const method = req.method;
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.sharedLogger.info(`[${requestId}] OAuth callback request`, {
      method,
      path,
      originalUrl: req.originalUrl,
      url: req.url,
      query: req.query,
    });

    try {
      // Don't follow redirects - we want to handle them ourselves
      const response = await this.gatewayService.forwardRequest(
        'aukro',
        `/aukro${path}`,
        method,
        undefined,
        this.getHeaders(req),
        false, // Don't follow redirects
      );

      // If it's a redirect response, redirect the client
      if (response && response._isRedirect && response.location) {
        const duration = Date.now() - startTime;
        this.sharedLogger.info(`[${requestId}] OAuth callback redirecting`, {
          status: response.status,
          location: response.location,
          duration: `${duration}ms`,
        });
        return res.redirect(response.status || 302, response.location);
      }

      // Otherwise return JSON response
      const duration = Date.now() - startTime;
      this.sharedLogger.info(`[${requestId}] OAuth callback completed`, {
        duration: `${duration}ms`,
      });
      return res.status(200).json(response);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.sharedLogger.error(`[${requestId}] OAuth callback error`, {
        error: error.message,
        duration: `${duration}ms`,
      });
      const errorStatus = error.response?.status || 500;
      return res.status(errorStatus).json({
        success: false,
        error: {
          code: 'OAUTH_CALLBACK_ERROR',
          message: error.response?.data?.error?.message || error.message || 'OAuth callback failed',
        },
      });
    }
  }

  /**
   * Route aukro requests (requires auth)
   */
  @All('aukro/*')
  @UseGuards(JwtAuthGuard)
  async aukroRoute(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    const path = req.url.replace('/api/aukro', '');
    return this.routeRequest('aukro', `/aukro${path}`, req, res);
  }

  /**
   * Route import requests (requires auth)
   */
  @All('import/*')
  @UseGuards(JwtAuthGuard)
  async importRoute(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    const path = req.url.replace('/api/import', '');
    return this.routeRequest('import', `/import${path}`, req, res);
  }

  /**
   * Route settings requests (requires auth)
   * Handle both /api/settings and /api/settings/*
   * IMPORTANT: settings/* must come BEFORE settings to match /api/settings/* first
   */
  @All('settings/*')
  @UseGuards(JwtAuthGuard)
  async settingsRoute(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    const path = req.url.replace('/api/settings', '');
    return this.routeRequest('settings', `/settings${path}`, req, res);
  }

  @All('settings')
  @UseGuards(JwtAuthGuard)
  async settingsBaseRoute(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    const path = req.url.replace('/api/settings', '') || '';
    return this.routeRequest('settings', `/settings${path}`, req, res);
  }

  /**
   * Route auth requests (no auth required for register/login)
   * Must be before catch-all to match correctly
   * Use explicit routes for common endpoints and catch-all for others
   */
  @All('auth/login')
  async authLogin(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    // Temporary debug: log incoming login payload to troubleshoot empty/invalid bodies in dev
    this.logger.warn(`Auth login payload | url=${req.originalUrl}`, {
      body: req.body,
      hasBody: !!req.body,
      contentType: req.headers['content-type'],
    });
    return this.routeRequest('auth', '/auth/login', req, res);
  }

  @All('auth/register')
  async authRegister(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return this.routeRequest('auth', '/auth/register', req, res);
  }

  @All('auth/refresh')
  async authRefresh(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    return this.routeRequest('auth', '/auth/refresh', req, res);
  }

  @All('auth/*')
  async authRoute(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    this.sharedLogger.info(`[Auth Route] Matched: ${req.method} ${req.originalUrl}`, {
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
    });
    const path = req.url.replace('/api/auth', '');
    return this.routeRequest('auth', `/auth${path}`, req, res);
  }

  @All('auth')
  async authBaseRoute(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    this.sharedLogger.info(`[Auth Base Route] Matched: ${req.method} ${req.originalUrl}`, {
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
    });
    const path = req.url.replace('/api/auth', '') || '';
    return this.routeRequest('auth', `/auth${path}`, req, res);
  }

  /**
   * Catch-all for /api/ root - return helpful error
   * This must be last to not interfere with specific routes
   */
  @All()
  async apiRoot(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    // Log the request for debugging (production logging)
    this.sharedLogger.warn(`[API Root] Unmatched request: ${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
      baseUrl: req.baseUrl,
      query: req.query,
      params: req.params,
      headers: {
        host: req.headers.host,
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
      },
    });
    this.logger.warn(`[API Root] Unmatched: ${req.method} ${req.originalUrl} | url: ${req.url} | path: ${req.path}`);
    
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.url}. Available endpoints: /api/auth/*, /api/aukro/*, /api/import/*, /api/settings/*`,
      },
      path: req.url,
      originalUrl: req.originalUrl,
      requestPath: req.path,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Helper to route request
   */
  private async routeRequest(
    serviceName: string,
    path: string,
    req: ExpressRequest,
    res: ExpressResponse,
  ) {
    const method = req.method;
    const body = method !== 'GET' && method !== 'DELETE' ? req.body : undefined;
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Log incoming request with detailed body information
    this.sharedLogger.info(`[${timestamp}] [TIMING] GatewayController.routeRequest START`, {
      requestId,
      serviceName,
      method,
      path,
    });
    this.sharedLogger.info(`[${requestId}] Incoming API request`, {
      serviceName,
      method,
      path,
      originalUrl: req.originalUrl,
      url: req.url,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      hasAuth: !!req.headers.authorization,
      hasBody: !!body,
      bodyType: typeof body,
      bodyValue: body ? (typeof body === 'object' ? JSON.stringify(body).substring(0, 200) : String(body).substring(0, 200)) : 'undefined',
      contentType: req.headers['content-type'],
    });
    this.logger.log(`[${requestId}] ${method} ${req.originalUrl} -> ${serviceName}${path}`);

    try {
      const response = await this.gatewayService.forwardRequest(
        serviceName,
        path,
        method,
        body,
        this.getHeaders(req),
      );
      
      const duration = Date.now() - startTime;
      this.sharedLogger.info(`[${new Date().toISOString()}] [TIMING] GatewayController.routeRequest COMPLETE (${duration}ms)`, {
        requestId,
        serviceName,
        method,
        path,
        statusCode: 200,
        durationMs: duration,
      });
      this.sharedLogger.info(`[${requestId}] Request completed successfully`, {
        serviceName,
        method,
        path,
        statusCode: 200,
        duration: `${duration}ms`,
      });
      
      res.status(200).json(response);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorStatus = error.response?.status || error.status;
      const errorDetails = {
        serviceName,
        method,
        path,
        originalUrl: req.originalUrl,
        duration: `${duration}ms`,
        errorType: error.constructor?.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorStatus,
        errorData: error.response?.data,
      };

      // Handle 401 Unauthorized - don't log as error for auth endpoints (expected response)
      if (errorStatus === 401 && serviceName === 'auth') {
        // Pass through the 401 response from auth service
        const errorData = error.response?.data || { message: 'Invalid credentials', error: 'Unauthorized' };
        this.sharedLogger.info(`[${requestId}] Authentication failed (expected)`, {
          serviceName,
          method,
          path,
          duration: `${duration}ms`,
        });
        this.logger.debug(`[${requestId}] ${method} ${req.originalUrl} - 401 (authentication failed)`);
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: errorData.message || 'Invalid credentials',
            statusCode: 401,
          },
        });
        return;
      }

      // Handle UnauthorizedException properly
      if (error instanceof UnauthorizedException) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Authentication required',
          },
        });
        return;
      }

      // Log other errors
      this.sharedLogger.error(`[${requestId}] Request failed`, errorDetails);
      this.logger.error(`[${requestId}] ${method} ${req.originalUrl} failed: ${error.message}`, errorDetails);

      // Handle timeout errors (auth service unreachable)
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: `Unable to reach ${serviceName} service. Please check if the service is running and accessible.`,
          },
        });
        return;
      }

      // Handle connection errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: `Cannot connect to ${serviceName} service. Please check network connectivity and service configuration.`,
          },
        });
        return;
      }

      // Handle 409 Conflict (user already exists, etc.)
      if (error.response?.status === 409) {
        res.status(409).json({
          success: false,
          error: {
            code: error.response?.data?.error?.code || 'CONFLICT',
            message: error.response?.data?.error?.message || error.response?.data?.message || 'Resource already exists',
          },
        });
        return;
      }

      // Handle other errors
      const statusCode = error.response?.status || error.status || 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.response?.data?.error?.code || 'GATEWAY_ERROR',
          message: error.response?.data?.error?.message || error.response?.data?.message || error.message || 'Internal server error',
        },
      });
    }
  }

  /**
   * Get headers from request
   */
  private getHeaders(req: ExpressRequest): Record<string, string> {
    const headers: Record<string, string> = {};

    // Forward authorization header
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // Forward user ID if available from JWT guard
    if ((req as any).user?.id) {
      headers['X-User-Id'] = (req as any).user.id;
    }

    return headers;
  }
}

