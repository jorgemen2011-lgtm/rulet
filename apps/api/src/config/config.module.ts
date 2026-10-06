import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service.js';
import { validateEnv } from './env.js';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ validate: validateEnv, cache: true })],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
