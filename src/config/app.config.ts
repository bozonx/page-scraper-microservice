import { registerAs } from '@nestjs/config';
import { IsInt, IsString, IsIn, Min, Max, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * Application configuration settings
 * Defines the basic runtime parameters for the application
 */
export class AppConfig {
  /**
   * Server port number (1-65535)
   */
  @IsInt()
  @Min(1)
  @Max(65535)
  public port!: number;

  /**
   * Host address to bind the server to
   */
  @IsString()
  public host!: string;

  /**
   * Base path for API endpoints (e.g., 'api' will make endpoints available at /api/v1/...)
   */
  @IsString()
  public apiBasePath!: string;

  /**
   * Node.js environment mode
   */
  @IsIn(['development', 'production', 'test'])
  public nodeEnv!: string;

  /**
   * Logging level for Pino logger
   * Allow only Pino log levels: trace, debug, info, warn, error, fatal, silent
   */
  @IsIn(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
  public logLevel!: string;
}

/**
 * Application configuration factory
 * Validates and provides application configuration from environment variables
 */
export default registerAs('app', (): AppConfig => {
const config = plainToClass(AppConfig, {
  port: parseInt(process.env.LISTEN_PORT ?? '8080', 10),
  host: process.env.LISTEN_HOST ?? '0.0.0.0',
  apiBasePath: (process.env.API_BASE_PATH ?? 'api').replace(/^\/+|\/+$/g, ''),
  nodeEnv: process.env.NODE_ENV ?? 'production',
  logLevel: process.env.LOG_LEVEL ?? 'warn',
});

  // Validate configuration and throw error if invalid
  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`App config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});