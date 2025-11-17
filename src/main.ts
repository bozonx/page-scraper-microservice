import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'
import { AppModule } from '@/app.module.js'
import type { AppConfig } from '@config/app.config.js'

/**
 * Bootstrap function that initializes and starts the NestJS application
 * Configures Fastify adapter, validation, logging, and graceful shutdown
 */
async function bootstrap() {
  // Create app with bufferLogs enabled to capture early logs
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // We'll use Pino logger instead
    }),
    {
      bufferLogs: true,
    }
  )

  // Use Pino logger for the entire application
  app.useLogger(app.get(Logger))

  const configService = app.get(ConfigService)
  const logger = app.get(Logger)

  const appConfig = configService.get<AppConfig>('app')!

  // Configure global validation pipe with transformation
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  )

  // Configure global API prefix from configuration
  const globalPrefix = `${appConfig.apiBasePath}/v1`
  app.setGlobalPrefix(globalPrefix)

  // Enable graceful shutdown hooks for proper cleanup
  app.enableShutdownHooks()

  // Start the server
  await app.listen(appConfig.port, appConfig.host)

  // Log startup information
  logger.log(
    `🚀 NestJS service is running on: http://${appConfig.host}:${appConfig.port}/${globalPrefix}`,
    'Bootstrap'
  )
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap')
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap')

  // Rely on enableShutdownHooks for graceful shutdown
}

// Start the application
void bootstrap()
