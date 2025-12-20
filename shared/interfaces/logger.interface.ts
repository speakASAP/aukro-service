/**
 * Logger Interface
 * All methods are non-blocking (fire and forget)
 */

export interface ILogger {
  error(message: string, traceOrMetadata?: string | Record<string, any>, context?: string): void;
  warn(message: string, contextOrMetadata?: string | Record<string, any>): void;
  log(message: string, contextOrMetadata?: string | Record<string, any>): void;
  info(message: string, metadata?: Record<string, any>): void;
  debug(message: string, metadata?: Record<string, any>): void;
  verbose(message: string, context?: string): void;
}

