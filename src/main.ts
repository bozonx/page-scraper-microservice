import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'
import fastifyStatic from '@fastify/static'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppModule } from './app.module.js'
import type { AppConfig } from './config/app.config.js'
import { ShutdownService } from './common/services/shutdown.service.js'
import { APP_CLOSE_TIMEOUT_MS } from './common/app.constants.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')

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
      // Force close idle connections on shutdown
      forceCloseConnections: 'idle',
    }),
    {
      bufferLogs: true,
    }
  )

  // Use Pino logger for the entire application
  app.useLogger(app.get(Logger))

  const configService = app.get(ConfigService)
  const logger = app.get(Logger)

  const shutdownService = app.get(ShutdownService)

  const appConfig = configService.get<AppConfig>('app')!

  const buildPath = (...parts: Array<string | undefined>) => {
    const cleaned = parts
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .map((p) => p.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
    return `/${cleaned.join('/')}`
  }

  // Configure global validation pipe with transformation
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  )

  // Configure global API prefix from configuration
  const globalPrefix = [appConfig.basePath, 'api/v1'].filter(Boolean).join('/')
  app.setGlobalPrefix(globalPrefix)

  // Register static file serving for test UI
  // Served under /{BASE_PATH}/ui
  await app.register(fastifyStatic, {
    root: join(__dirname, '..', '..', 'public'),
    prefix: `${buildPath(appConfig.basePath, 'ui')}/`,
  })

  // Enable graceful shutdown hooks: Disabled in favor of custom handling
  // app.enableShutdownHooks()

  const waitForActiveRequests = async (timeoutMs: number) => {
    const startedAt = Date.now()
    while (shutdownService.getActiveRequests() > 0) {
      if (Date.now() - startedAt > timeoutMs) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  // Setup graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    if (shutdownService.isShuttingDown()) {
      logger.warn(`Received ${signal} while shutting down, ignoring...`)
      return
    }
    logger.warn(`Received ${signal}, starting graceful shutdown...`)
    shutdownService.markShuttingDown()

    // Set timeout for graceful shutdown
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded, forcing exit')
      process.exit(1)
    }, APP_CLOSE_TIMEOUT_MS)

    try {
      // Give in-flight requests a short window to finish before closing the app.
      // New requests are blocked by ShutdownGuard.
      await waitForActiveRequests(Math.min(10_000, APP_CLOSE_TIMEOUT_MS))

      await app.close()
      clearTimeout(shutdownTimeout)
      logger.log('Graceful shutdown completed successfully')
      process.exitCode = 0
    } catch (error) {
      clearTimeout(shutdownTimeout)
      logger.error('Error during graceful shutdown', error)
      process.exitCode = 1
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  // Start the server
  await app.listen(appConfig.port, appConfig.host)

  // Log startup information
  logger.log(
    `NestJS service is running on: http://${appConfig.host}:${appConfig.port}${buildPath(globalPrefix)}`,
    'Bootstrap'
  )
  logger.log(
    `Test UI available at: http://${appConfig.host}:${appConfig.port}${buildPath(
      appConfig.basePath,
      'ui'
    )}/`,
    'Bootstrap'
  )
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap')
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap')
  logger.log(`⏱️  Graceful Shutdown Timeout: ${APP_CLOSE_TIMEOUT_MS}ms`, 'Bootstrap')
}

// Start the application
void bootstrap()
