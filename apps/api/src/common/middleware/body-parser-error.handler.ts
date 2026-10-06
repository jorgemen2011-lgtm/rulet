import { HttpStatus } from '@nestjs/common';
import type { ApiErrorResponse } from '@rulet/shared';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from './request-id.middleware.js';

const MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Cuerpo de la petición mal formado',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Cuerpo de la petición demasiado grande',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Codificación del cuerpo no soportada',
};

function httpStatusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

/**
 * Los errores del body parser (JSON inválido, límite de tamaño…) ocurren en Express antes de llegar a Nest,
 * así que `AllExceptionsFilter` no los ve. Este manejador les da el mismo formato `ApiErrorResponse`
 * y evita la página HTML por defecto de Express (que en desarrollo incluye la traza).
 */
export function bodyParserErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const statusCode = httpStatusOf(err);
  if (statusCode === undefined || res.headersSent) {
    next(err);
    return;
  }
  const body: ApiErrorResponse = {
    statusCode,
    error: HttpStatus[statusCode] ?? 'ERROR',
    message: MESSAGES[statusCode] ?? 'Petición inválida',
    path: req.url,
    requestId: req.header(REQUEST_ID_HEADER),
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(body);
}
