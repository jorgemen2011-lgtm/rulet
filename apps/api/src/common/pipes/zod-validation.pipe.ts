import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/**
 * Valida body/query/params con un esquema de `@rulet/shared/contracts`, el mismo
 * que usan los clientes. Uso: `@Body(new ZodValidationPipe(CreateXSchema)) dto: CreateX`.
 */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({ message: 'Datos inválidos', details: z.flattenError(result.error) });
    }
    return result.data;
  }
}
