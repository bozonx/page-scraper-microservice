import 'reflect-metadata'
import { setTimeout as sleep } from 'node:timers/promises'
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
import { buildApiPrefix } from './common/http/api-prefix.js'
import { SERVICE_NAME, SERVICE_VERSION } from './config/service-info.js'

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
  const globalPrefix = buildApiPrefix(appConfig.basePath)
  app.setGlobalPrefix(globalPrefix)

  // Register static file serving for test UI
  // Served under /{BASE_PATH}/ui
  if (appConfig.enableUi) {
    const uiPath = buildPath(appConfig.basePath, 'ui')
    const uiPrefix = `${uiPath}/`

    // Enable Basic Auth for UI if configured
    if (appConfig.authBasicUser && appConfig.authBasicPass) {
      app
        .getHttpAdapter()
        .getInstance()
        .addHook('preHandler', (request, reply, done) => {
          if (!request.url.startsWith(uiPrefix)) {
            return done()
          }

          const authHeader = request.headers.authorization
          if (!authHeader?.startsWith('Basic ')) {
            reply.header('WWW-Authenticate', 'Basic realm="Test UI"')
            reply.code(401).send({ message: 'Basic authentication required for UI' })
            return
          }

          const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':')
          if (
            credentials[0] !== appConfig.authBasicUser ||
            credentials[1] !== appConfig.authBasicPass
          ) {
            reply.header('WWW-Authenticate', 'Basic realm="Test UI"')
            reply.code(401).send({ message: 'Invalid Basic authentication' })
            return
          }

          done()
        })
    }

    await app.register(fastifyStatic, {
      root: join(__dirname, '..', '..', 'public'),
      prefix: uiPrefix,
    })
  }

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
      if (appConfig.shutdownDrainSeconds > 0) {
        await sleep(appConfig.shutdownDrainSeconds * 1000)
      }
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

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'))

  // Start the server
  await app.listen(appConfig.port, appConfig.host)

  // Log startup information
  logger.log(
    `${SERVICE_NAME} ${SERVICE_VERSION} listening on http://${appConfig.host}:${appConfig.port}${buildPath(globalPrefix)}`,
    'Bootstrap'
  )
  if (appConfig.enableUi) {
    logger.log(
      `Test UI available at: http://${appConfig.host}:${appConfig.port}${buildPath(
        appConfig.basePath,
        'ui'
      )}/`,
      'Bootstrap'
    )
  }
  logger.log(`📊 Environment: ${appConfig.nodeEnv}`, 'Bootstrap')
  logger.log(`📝 Log level: ${appConfig.logLevel}`, 'Bootstrap')
  logger.log(`⏱️  Graceful Shutdown Timeout: ${APP_CLOSE_TIMEOUT_MS}ms`, 'Bootstrap')
}

// Start the application
void bootstrap()
