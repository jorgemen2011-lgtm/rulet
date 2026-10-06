import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  // Otros módulos (auth) usan el servicio, nunca el repositorio.
  exports: [UsersService],
})
export class UsersModule {}
