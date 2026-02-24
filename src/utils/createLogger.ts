import { logger, LogContext } from './logger';

export const createLogger = (component: string) => ({
  debug: (message: string, context?: LogContext) => 
    logger.debug(message, { component, ...context }),
  
  info: (message: string, context?: LogContext) => 
    logger.info(message, { component, ...context }),
  
  warn: (message: string, context?: LogContext) => 
    logger.warn(message, { component, ...context }),
  
  error: (message: string, error?: Error, context?: LogContext) => 
    logger.error(message, error, { component, ...context })
});
