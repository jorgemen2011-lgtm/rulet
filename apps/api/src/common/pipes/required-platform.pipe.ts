import { BadRequestException, PipeTransform } from '@nestjs/common';
import { CLIENT_PLATFORM_HEADER, type Platform } from '@rulet/shared';

/**
 * Exige la cabecera de plataforma: `@ClientPlatform(RequiredPlatformPipe) platform: Platform`.
 * Se usa donde la respuesta depende de la plataforma (p. ej. auth: tokens en el cuerpo o en cookies).
 */
export class RequiredPlatformPipe implements PipeTransform<Platform | undefined, Platform> {
  transform(value: Platform | undefined): Platform {
    if (!value) {
      throw new BadRequestException(`Falta la cabecera ${CLIENT_PLATFORM_HEADER} (web | mobile)`);
    }
    return value;
  }
}
