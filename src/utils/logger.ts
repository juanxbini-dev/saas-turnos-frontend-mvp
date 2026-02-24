export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

export interface LogContext {
  component?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.level = this.getLogLevel();
    this.isDevelopment = (import.meta as any).env?.DEV;
  }

  private getLogLevel(): LogLevel {
    const envLevel = (import.meta as any).env?.VITE_LOG_LEVEL;
    return envLevel ? LogLevel[envLevel as keyof typeof LogLevel] : 
           ((import.meta as any).env?.DEV ? LogLevel.DEBUG : LogLevel.ERROR);
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level} ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext) {
    if (this.level <= LogLevel.DEBUG && this.isDevelopment) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (this.level <= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext) {
    if (this.level <= LogLevel.ERROR) {
      const errorContext = error ? { error: error.message, stack: error.stack } : {};
      console.error(this.formatMessage('ERROR', message, { ...context, ...errorContext }));
    }
  }
}

export const logger = new Logger();
