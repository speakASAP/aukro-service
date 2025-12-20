/**
 * Logger Service
 * NestJS service wrapper for centralized logger
 */

import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ILogger } from '../interfaces/logger.interface';
import loggerUtil from './logger.util';

@Injectable()
export class LoggerService implements NestLoggerService, ILogger {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  error(message: string, traceOrMetadata?: string | Record<string, any>, context?: string): void {
    try {
      const metadata: Record<string, any> = {};
      if (typeof traceOrMetadata === 'object' && traceOrMetadata !== null) {
        Object.assign(metadata, traceOrMetadata);
      } else if (traceOrMetadata) {
        metadata.trace = traceOrMetadata;
      }
      if (context || this.context) metadata.context = context || this.context;
      loggerUtil.error(message, metadata);
    } catch (error) {
      // Silently handle errors - don't block application
      if (process.env.NODE_ENV === 'development') {
        console.error('Logger error:', error);
      }
    }
  }

  warn(message: string, contextOrMetadata?: string | Record<string, any>): void {
    try {
      const metadata: Record<string, any> = {};
      if (typeof contextOrMetadata === 'object' && contextOrMetadata !== null) {
        Object.assign(metadata, contextOrMetadata);
      } else if (contextOrMetadata) {
        metadata.context = contextOrMetadata;
      }
      if (this.context) metadata.context = this.context;
      loggerUtil.warn(message, metadata);
    } catch (error) {
      // Silently handle errors - don't block application
      if (process.env.NODE_ENV === 'development') {
        console.error('Logger error:', error);
      }
    }
  }

  log(message: string, contextOrMetadata?: string | Record<string, any>): void {
    try {
      const metadata: Record<string, any> = {};
      if (typeof contextOrMetadata === 'object' && contextOrMetadata !== null) {
        Object.assign(metadata, contextOrMetadata);
      } else if (contextOrMetadata) {
        metadata.context = contextOrMetadata;
      }
      if (this.context) metadata.context = this.context;
      loggerUtil.info(message, metadata);
    } catch (error) {
      // Silently handle errors - don't block application
      if (process.env.NODE_ENV === 'development') {
        console.error('Logger error:', error);
      }
    }
  }

  info(message: string, metadata?: Record<string, any>): void {
    try {
      const logMetadata: Record<string, any> = metadata || {};
      if (this.context) logMetadata.context = this.context;
      loggerUtil.info(message, logMetadata);
    } catch (error) {
      // Silently handle errors - don't block application
      if (process.env.NODE_ENV === 'development') {
        console.error('Logger error:', error);
      }
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    try {
      const logMetadata: Record<string, any> = metadata || {};
      if (this.context) logMetadata.context = this.context;
      loggerUtil.debug(message, logMetadata);
    } catch (error) {
      // Silently handle errors - don't block application
      if (process.env.NODE_ENV === 'development') {
        console.error('Logger error:', error);
      }
    }
  }

  verbose(message: string, context?: string): void {
    try {
      const metadata: Record<string, any> = {};
      if (context || this.context) metadata.context = context || this.context;
      this.debug(message, metadata);
    } catch (error) {
      // Silently handle errors - don't block application
      if (process.env.NODE_ENV === 'development') {
        console.error('Logger error:', error);
      }
    }
  }
}

