import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(
    {
      err,
      req: {
        method: req.method,
        url: req.url,
        body: req.body,
        params: req.params,
        query: req.query,
      },
    },
    message,
  );

  res.status(statusCode).json({
    status: 'error',
    message:
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Something went wrong'
        : message,
    details: err.details || undefined,
  });
};
