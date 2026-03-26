import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodObject, ZodRawShape } from 'zod';

export const validate = (schema: ZodObject<ZodRawShape>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }
      return next(error);
    }
  };
};
