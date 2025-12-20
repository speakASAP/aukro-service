/**
 * Centralized Logger Utility (TypeScript)
 * Dual logging: sends logs to logging-microservice AND writes locally
 * Non-blocking: HTTP requests don't block application execution
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as os from 'os';

interface LoggerOptions {
  serviceName?: string;
  enableLocalLogging?: boolean;
  logDir?: string;
}

interface LogMetadata {
  [key: string]: any;
}

interface LogData {
  level: string;
  message: string;
  service: string;
  timestamp: string;
  metadata: LogMetadata & {
    pid: number;
    hostname: string;
  };
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export class Logger {
  private loggingServiceUrl: string;
  private logLevel: string;
  private timestampFormat: string;
  private serviceName: string;
  private enableLocalLogging: boolean;
  private logDir: string;
  private levels: Record<LogLevel, number>;
  private currentLevel: number;

  constructor(options: LoggerOptions = {}) {
    // Use LOGGING_SERVICE_URL from environment, required
    this.loggingServiceUrl = process.env.LOGGING_SERVICE_URL || this.throwConfigError('LOGGING_SERVICE_URL');
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.timestampFormat = process.env.LOG_TIMESTAMP_FORMAT || 'YYYY-MM-DD HH:mm:ss';
    this.serviceName = options.serviceName || process.env.SERVICE_NAME || 'aukro';
    this.enableLocalLogging = options.enableLocalLogging !== false;
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');

    // Ensure log directory exists
    if (this.enableLocalLogging && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Log levels priority
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    this.currentLevel = this.levels[this.logLevel as LogLevel] || this.levels.info;
  }

  /**
   * Format timestamp as ISO 8601
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format timestamp for local file logging (human-readable)
   */
  private formatTimestampLocal(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Capture stack trace for error logs
   */
  private captureStackTrace(): string | undefined {
    const error = new Error();
    if (error.stack) {
      // Remove the first 2 lines (Error and this function call)
      const lines = error.stack.split('\n');
      return lines.slice(2).join('\n');
    }
    return undefined;
  }

  /**
   * Send log to logging-microservice (non-blocking)
   * Fire and forget - doesn't block application execution
   */
  private sendToLoggingService(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
    // Capture stack trace for error-level logs
    const enhancedMetadata: LogMetadata = { ...metadata };
    if (level === 'error' && !enhancedMetadata.stack) {
      const stack = this.captureStackTrace();
      if (stack) {
        enhancedMetadata.stack = stack;
      }
    }

    const logData: LogData = {
      level,
      message,
      service: this.serviceName,
      timestamp: this.formatTimestamp(), // ISO 8601 format
      metadata: {
        ...enhancedMetadata,
        pid: process.pid,
        hostname: os.hostname(),
      },
    };

    // Fire and forget - non-blocking HTTP request
    setImmediate(() => {
      this.sendToLoggingServiceAsync(logData).catch((error) => {
        // Silently handle errors - don't block application
        // Only log to console in development mode
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to send log to logging service:', error.message);
        }
      });
    });
  }

  /**
   * Async HTTP request to logging service
   */
  private async sendToLoggingServiceAsync(logData: LogData): Promise<void> {
    try {
      const url = new URL(`${this.loggingServiceUrl}/api/logs`);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const postData = JSON.stringify(logData);

      const timeout = parseInt(process.env.LOGGING_SERVICE_TIMEOUT || process.env.HTTP_TIMEOUT || '5000');
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      await new Promise<void>((resolve, reject) => {
        const req = httpModule.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`Logging service returned ${res.statusCode}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        // CRITICAL: Set timeout on the request object - Node.js doesn't use timeout option automatically
        req.setTimeout(timeout, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
      });
    } catch (error) {
      // Re-throw to be caught by caller
      throw error;
    }
  }

  /**
   * Write log to local file (non-blocking)
   * Fire and forget - doesn't block application execution
   */
  private writeToLocalFile(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
    if (!this.enableLocalLogging) return;

    // Capture stack trace for error-level logs if not already present
    const enhancedMetadata: LogMetadata = { ...metadata };
    if (level === 'error' && !enhancedMetadata.stack) {
      const stack = this.captureStackTrace();
      if (stack) {
        enhancedMetadata.stack = stack;
      }
    }

    const timestamp = this.formatTimestampLocal(); // Human-readable format for local files
    const logEntry = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      metadata: enhancedMetadata,
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = path.join(this.logDir, `${level}.log`);
    const allLogFile = path.join(this.logDir, 'all.log');

    // Fire and forget - non-blocking file write
    setImmediate(() => {
      // Write to level-specific log file (async, non-blocking)
      fs.appendFile(logFile, logLine, 'utf8', (err) => {
        if (err) {
          // Silently handle errors - don't block application
          // Only log to console in development mode
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to write log to file:', err);
          }
        }
      });
      // Write to combined log file (async, non-blocking)
      fs.appendFile(allLogFile, logLine, 'utf8', (err) => {
        if (err) {
          // Silently handle errors - don't block application
          // Only log to console in development mode
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to write log to file:', err);
          }
        }
      });
    });
  }

  /**
   * Log message
   * Dual logging: always writes locally AND sends to external service (non-blocking)
   * All operations are fire-and-forget to prevent blocking
   */
  private log(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
    const levelPriority = this.levels[level] ?? this.levels.info;

    // Check if log level is enabled
    if (levelPriority > this.currentLevel) {
      return;
    }

    // DUAL LOGGING: Always write locally (non-blocking, fire and forget)
    this.writeToLocalFile(level, message, metadata);

    // Also send to external logging service (non-blocking, fire and forget)
    this.sendToLoggingService(level, message, metadata);

    // Also output to console in development
    if (process.env.NODE_ENV === 'development') {
      const timestamp = this.formatTimestampLocal();
      const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.serviceName}]`;
      console.log(`${prefix} ${message}`, Object.keys(metadata).length > 0 ? metadata : '');
    }
  }

  /**
   * Error level logging (non-blocking)
   */
  error(message: string, metadata: LogMetadata = {}): void {
    this.log('error', message, metadata);
  }

  /**
   * Warn level logging (non-blocking)
   */
  warn(message: string, metadata: LogMetadata = {}): void {
    this.log('warn', message, metadata);
  }

  /**
   * Info level logging (non-blocking)
   */
  info(message: string, metadata: LogMetadata = {}): void {
    this.log('info', message, metadata);
  }

  /**
   * Debug level logging (non-blocking)
   */
  debug(message: string, metadata: LogMetadata = {}): void {
    this.log('debug', message, metadata);
  }

  private throwConfigError(key: string): never {
    throw new Error(`Missing required environment variable: ${key}. Please set it in your .env file.`);
  }
}

// Create default logger instance
const logger = new Logger();

// Export both class and instance
export default logger;

