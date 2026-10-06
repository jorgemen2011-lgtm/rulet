import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  type {{entityPascal}},
  type Create{{entityPascal}}Request,
  Create{{entityPascal}}RequestSchema,
} from '@rulet/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
{{#if feature}}
import { RequireFeature } from '../../common/guards/feature.guard.js';
{{/if}}
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { {{namePascal}}Service } from './{{name}}.service.js';

/**
 * `/v1/{{name}}`. Este controller solo traduce HTTP ↔ servicio: valida la entrada con el contrato de
 * @rulet/shared y pasa la identidad del token (`@CurrentUser`), nunca un id de usuario que venga del cliente.
 *
 * Seguro por defecto: el JwtAuthGuard global exige access token en todas las rutas. No añadas `@Public()` salvo
 * que el recurso deba ser accesible sin sesión.
 *
 * Para restringir por rol, en la clase o en un método:
 *   import { Roles } from '../../common/decorators/roles.decorator.js';
 *   @Roles('admin')
 */
{{#if feature}}
@RequireFeature('{{nameCamel}}')
{{/if}}
@Controller('{{name}}')
export class {{namePascal}}Controller {
  constructor(private readonly service: {{namePascal}}Service) {}

  @Get()
  list(@CurrentUser() current: AuthUser): Promise<{{entityPascal}}[]> {
    return this.service.list(current.id);
  }

  @Get(':id')
  get(
    @CurrentUser() current: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{{entityPascal}}> {
    return this.service.get(current.id, id);
  }

  @Post()
  create(
    @CurrentUser() current: AuthUser,
    @Body(new ZodValidationPipe(Create{{entityPascal}}RequestSchema)) body: Create{{entityPascal}}Request,
  ): Promise<{{entityPascal}}> {
    return this.service.create(current.id, body);
  }
}
