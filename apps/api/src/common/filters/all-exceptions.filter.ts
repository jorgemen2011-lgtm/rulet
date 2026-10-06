import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ApiErrorResponse } from '@rulet/shared';
import type { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware.js';

/**
 * Convierte cualquier excepción en la forma `ApiErrorResponse` de @rulet/shared.
 * Los errores no controlados se registran completos pero nunca se filtran al cliente.
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
      this.logger.error({ requestId, path: req.url, err: exception }, (exception as Error)?.stack);
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
