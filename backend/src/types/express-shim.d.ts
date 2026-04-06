declare module 'express' {
  export interface Request {
    method: string;
    url: string;
    body: any;
    params: any;
    query: any;
  }

  export interface Response {
    status(code: number): Response;
    json(body: any): Response;
  }

  export type NextFunction = (err?: any) => void;

  const express: any;
  export default express;
}
