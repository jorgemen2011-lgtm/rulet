import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

// Solo se reutiliza un id entrante con forma segura: evita inyectar saltos de línea o basura en los logs.
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/**
 * Asigna un id a cada petición (o reutiliza el del balanceador) para trazarla en logs y errores.
 * Es middleware de Express y se registra el primero en `app.setup.ts`, para que también lo lleven
 * los errores que ocurren antes de llegar a Nest (p. ej. cuerpo demasiado grande).
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.headers[REQUEST_ID_HEADER] = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
