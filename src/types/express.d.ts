import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Query } from 'express-serve-static-core';

// Express type augmentation
declare global {
  namespace Express {
    interface Request<
      P = Record<string, string>,
      ResBody = any,
      ReqBody = any,
      ReqQuery = Query
    > extends ExpressRequest<P, ResBody, ReqBody, ReqQuery> {}

    interface Response<ResBody = any> extends ExpressResponse<ResBody> {}

    interface ParamsDictionary {
      [key: string]: string;
    }
  }
}

// Make sure TypeScript knows this is a module
export { };
