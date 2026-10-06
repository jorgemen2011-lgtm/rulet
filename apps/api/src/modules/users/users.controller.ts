import { Controller, Get } from '@nestjs/common';
import type { User } from '@rulet/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() current: AuthUser): Promise<User> {
    return this.users.getProfile(current.id);
  }
}
