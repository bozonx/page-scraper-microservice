import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { HealthModule } from '@modules/health/health.module.js'
import { ScraperModule } from '@modules/scraper/scraper.module.js'
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter.js'
import appConfig from '@config/app.config.js'
import scraperConfig from '@config/scraper.config.js'
import type { AppConfig } from '@config/app.config.js'
import pkg from '../package.json'

/**
 * Root module of the application
 * Configures global modules, logging, exception handling, and imports feature modules
 */
@Module({
  imports: [
    // Global configuration module with environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, scraperConfig],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      cache: true,
    }),

    // Pino logger configuration with structured logging
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const appConfig = configService.get<AppConfig>('app')!
        const isDev = appConfig.nodeEnv === 'development'

        return {
          pinoHttp: {
            level: appConfig.logLevel,
            timestamp: () => `,"@timestamp":"${new Date().toISOString()}"`,
            base: {
              service: (pkg as any).name ?? 'app',
              environment: appConfig.nodeEnv,
            },
            // Pretty printing for development environment
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: false,
                    translateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'",
                    ignore: 'pid,hostname',
                    messageFormat: '[{context}] {msg}',
                  },
                }
              : undefined,
            // Custom serializers for request/response/error formatting
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                path: req.url?.split('?')[0],
                remoteAddress: req.ip,
                remotePort: req.socket?.remotePort,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
              err: (err) => ({
                type: err.type,
                message: err.message,
                stack: err.stack,
              }),
            },
            // Redact sensitive information from logs
            redact: {
              paths: ['req.headers.authorization', 'req.headers["x-api-key"]'],
              censor: '[REDACTED]',
            },
            // Dynamic log level based on response status
            customLogLevel: (req, res, err) => {
              if (res.statusCode >= 500 || err) {
                return 'error'
              }
              if (res.statusCode >= 400) {
                return 'warn'
              }
              if (res.statusCode >= 300) {
                return 'info'
              }
              return 'info'
            },
            // Skip health endpoint logging in production
            autoLogging: {
              ignore: (req) => {
                if (appConfig.nodeEnv === 'production') {
                  return req.url?.includes('/health') || false
                }
                return false
              },
            },
          },
        }
      },
    }),

    // Feature modules
    HealthModule,
    ScraperModule,
  ],
  controllers: [],
  providers: [
    // Global exception filter for consistent error responses
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
