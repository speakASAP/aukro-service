/**
 * Prisma Service
 * Provides Prisma Client instance for database access
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    let databaseUrl = process.env.DATABASE_URL;

    let isValidUrl = false;
    if (databaseUrl) {
      if (databaseUrl.includes('DATABASE_URL=')) {
        databaseUrl = databaseUrl.replace(/^DATABASE_URL=/, '');
      }

      if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
        try {
          new URL(databaseUrl);
          isValidUrl = true;
        } catch {
          isValidUrl = false;
        }
      }
    }

    if (!isValidUrl) {
      const dbHost = process.env.DB_HOST;
      const dbPort = process.env.DB_PORT;
      const dbUser = process.env.DB_USER;
      const dbPassword = process.env.DB_PASSWORD || '';
      const dbName = process.env.DB_NAME;

      if (!dbHost || !dbPort || !dbUser || !dbName) {
        throw new Error('Missing required database configuration. Please set DB_HOST, DB_PORT, DB_USER, and DB_NAME environment variables, or provide a valid DATABASE_URL.');
      }

      const encodedPassword = encodeURIComponent(dbPassword);
      databaseUrl = `postgresql://${dbUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}?schema=public&connection_limit=10&pool_timeout=5&connect_timeout=2`;
      process.env.DATABASE_URL = databaseUrl;
    } else {
      if (databaseUrl && !databaseUrl.includes('connection_limit=')) {
        const separator = databaseUrl.includes('?') ? '&' : '?';
        databaseUrl = `${databaseUrl}${separator}connection_limit=10&pool_timeout=5&connect_timeout=2`;
        process.env.DATABASE_URL = databaseUrl;
      }
    }

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma Client connected to database');
      try {
        await this.$queryRaw`SELECT 1`;
        this.logger.log('Prisma connection pool warmed up');
      } catch (warmupError) {
        this.logger.warn('Prisma connection warmup query failed (non-critical)', warmupError);
      }
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma Client disconnected from database');
  }
}

