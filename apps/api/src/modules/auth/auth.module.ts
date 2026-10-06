import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ACCESS_TOKEN_TTL_SECONDS } from '@rulet/shared';
import { AppConfigService } from '../../config/app-config.service.js';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionsRepository } from './sessions.repository.js';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const issuer = config.get('JWT_ISSUER');
        const audience = config.get('JWT_AUDIENCE');
        return {
          secret: config.get('JWT_ACCESS_SECRET'),
          signOptions: { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS, issuer, audience },
          // Algoritmo fijado: evita ataques de confusión de algoritmo (`alg: none`, RS/HS).
          verifyOptions: { algorithms: ['HS256'], issuer, audience },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenService, PasswordHasher, SessionsRepository],
  // JwtAuthGuard (global, en AppModule) necesita verificar tokens.
  exports: [AccessTokenService],
})
export class AuthModule {}
