import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import type { AppConfig } from '../../config/app.config.js'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const appConfig = this.configService.get<AppConfig>('app')!
    const allowedTokens = appConfig.authBearerTokens
    const basicUser = appConfig.authBasicUser
    const basicPass = appConfig.authBasicPass

    const hasBearerConfig = allowedTokens && allowedTokens.length > 0
    const hasBasicConfig = !!(basicUser && basicPass)

    // If no authentication methods are configured, allow access
    if (!hasBearerConfig && !hasBasicConfig) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const { authorization } = request.headers

    const createUnauthorized = (message: string) => {
      if (hasBasicConfig) {
        const response = context.switchToHttp().getResponse()
        response.header('WWW-Authenticate', 'Basic realm="Test UI"')
      }
      return new UnauthorizedException(message)
    }

    if (!authorization) {
      throw createUnauthorized('Missing authentication')
    }

    // Try Bearer Auth
    if (hasBearerConfig && authorization!.startsWith('Bearer ')) {
      const token = authorization!.substring(7)
      if (allowedTokens.includes(token)) {
        return true
      }
      throw createUnauthorized('Invalid bearer token')
    }

    // Try Basic Auth
    if (hasBasicConfig && authorization!.startsWith('Basic ')) {
      const credentials = Buffer.from(authorization!.substring(6), 'base64').toString().split(':')
      if (credentials[0] === basicUser && credentials[1] === basicPass) {
        return true
      }
      throw createUnauthorized('Invalid basic credentials')
    }

    throw createUnauthorized('Unsupported or invalid authentication method')
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
