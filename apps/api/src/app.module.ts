import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { CsrfGuard } from './common/guards/csrf.guard.js';
import { FeatureGuard } from './common/guards/feature.guard.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AppConfigService } from './config/app-config.service.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { accountThrottler } from './modules/auth/account-throttler.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    // Contadores en memoria (por proceso): con varias réplicas cada una cuenta por separado y el límite real
    // se multiplica por su número. Para escalar en horizontal hace falta un `storage` compartido (p. ej. Redis).
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        // `default`: por IP, en todas las rutas. `account`: por cuenta, solo donde se pide (`@ThrottleByAccount`).
        { ttl: config.get('THROTTLE_TTL_MS'), limit: config.get('THROTTLE_LIMIT') },
        accountThrottler,
      ],
    }),
    // Módulos de dominio: uno por carpeta en src/modules.
    AuthModule,
    HealthModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Guards globales, en este orden: rate limit → CSRF → autenticación → rol → funcionalidad por plataforma.
    // Seguro por defecto: toda ruta exige token salvo `@Public()`.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
})
export class AppModule {}
