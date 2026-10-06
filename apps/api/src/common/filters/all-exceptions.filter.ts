import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ApiErrorResponse } from '@rulet/shared';
import { DrizzleQueryError } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware.js';

interface LoggedError {
  name: string;
  message: string;
  query?: string;
  code?: string;
  cause?: string;
}

/** Traza sin su cabecera (`Nombre: mensaje`, que puede ocupar varias líneas): solo los marcos `at …`. */
function stackFrames(error: Error): string | undefined {
  const frames = error.stack?.split('\n').filter((line) => /^\s+at /.test(line));
  return frames && frames.length > 0 ? frames.join('\n') : undefined;
}

/**
 * Lo que se registra de un error no controlado. Nunca el objeto tal cual: el error de consulta de Drizzle
 * lleva los parámetros enlazados (emails, hashes de contraseña o de tokens) en `message`, `stack` y `params`.
 * De él solo se registran la consulta (con marcadores `$1`), y el código y mensaje del error de `pg`.
 */
export function describeError(exception: unknown): { error: LoggedError; stack?: string } {
  if (!(exception instanceof Error)) return { error: { name: 'NonError', message: String(exception) } };
  if (exception instanceof DrizzleQueryError) {
    const cause = exception.cause instanceof Error ? exception.cause : undefined;
    const code = (cause as { code?: unknown } | undefined)?.code;
    return {
      error: {
        name: 'DrizzleQueryError',
        message: 'Failed query',
        query: exception.query,
        ...(typeof code === 'string' && { code }),
        ...(cause && { cause: cause.message }),
      },
      stack: stackFrames(exception),
    };
  }
  return { error: { name: exception.name, message: exception.message }, stack: exception.stack };
}

/**
 * Convierte cualquier excepción en la forma `ApiErrorResponse` de @rulet/shared.
 * Los errores no controlados se registran (depurados de datos sensibles) pero nunca se filtran al cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.header(REQUEST_ID_HEADER);

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : null;
    const payloadObj =
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};

    if (!isHttp) {
      const { error, stack } = describeError(exception);
      this.logger.error({ requestId, path: req.url, err: error }, stack);
    }

    const body: ApiErrorResponse = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'ERROR',
      message: isHttp
        ? typeof payload === 'string'
          ? payload
          : String(payloadObj.message ?? exception.message)
        : 'Error interno del servidor',
      ...(payloadObj.details !== undefined && { details: payloadObj.details }),
      path: req.url,
      requestId,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(body);
  }
}
