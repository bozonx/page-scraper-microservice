import { registerAs } from '@nestjs/config';
import { IsInt, IsString, IsIn, Min, Max, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';

export class AppConfig {
  @IsInt()
  @Min(1)
  @Max(65535)
  public port!: number;

  @IsString()
  public host!: string;

  @IsString()
  public apiBasePath!: string;

  @IsIn(['development', 'production', 'test'])
  public nodeEnv!: string;

  // Allow only Pino log levels
  @IsIn(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
  public logLevel!: string;
}

export default registerAs('app', (): AppConfig => {
  const config = plainToClass(AppConfig, {
    port: parseInt(process.env.LISTEN_PORT ?? '80', 10),
    host: process.env.LISTEN_HOST ?? '0.0.0.0',
    apiBasePath: (process.env.API_BASE_PATH ?? 'api').replace(/^\/+|\/+$/g, ''),
    nodeEnv: process.env.NODE_ENV ?? 'production',
    logLevel: process.env.LOG_LEVEL ?? 'warn',
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(err => Object.values(err.constraints ?? {}).join(', '));
    throw new Error(`App config validation error: ${errorMessages.join('; ')}`);
  }

  return config;
});
