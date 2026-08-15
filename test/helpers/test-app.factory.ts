import { Test } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '@/app.module.js'
import { buildApiPrefix } from '@/common/http/api-prefix.js'

export async function createTestApp(): Promise<NestFastifyApplication> {
  // Ensure defaults the same as in main.ts
  // Ensure defaults the same as in main.ts
  process.env.BASE_PATH = process.env.BASE_PATH ?? ''

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      logger: false, // We'll use Pino logger instead
    })
  )

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  )

  const globalPrefix = buildApiPrefix(process.env.BASE_PATH)
  app.setGlobalPrefix(globalPrefix)

  await app.init()
  // Ensure Fastify has completed plugin registration and routing before tests
  await app.getHttpAdapter().getInstance().ready()
  return app
}
