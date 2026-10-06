import { Module } from '@nestjs/common';
import { {{namePascal}}Controller } from './{{name}}.controller.js';
import { {{namePascal}}Repository } from './{{name}}.repository.js';
import { {{namePascal}}Service } from './{{name}}.service.js';

@Module({
  controllers: [{{namePascal}}Controller],
  providers: [{{namePascal}}Service, {{namePascal}}Repository],
  // Si otro módulo necesita esta lógica, exporta el servicio (nunca el repositorio).
})
export class {{namePascal}}Module {}
