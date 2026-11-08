import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ProblemDetails } from '@skytech/contracts';
import type { Request, Response } from 'express';
import { ProblemException, problemTitle } from './problem.js';

/** Every error leaves the API as application/problem+json (RFC 9457). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemDetails');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const problem = this.toProblem(exception, req);
    if (problem.status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    if (exception instanceof ProblemException && exception.code) {
      res.setHeader('X-Problem-Code', exception.code);
    }
    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, req: Request): ProblemDetails {
    const instance = req.originalUrl.split('?')[0];
    if (exception instanceof ProblemException) {
      const status = exception.getStatus();
      return {
        type: 'about:blank',
        title: problemTitle(status),
        status,
        detail: exception.message,
        instance,
        ...(exception.errors ? { errors: exception.errors } : {}),
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'object' && 'message' in response
          ? String(response.message)
          : exception.message;
      return { type: 'about:blank', title: problemTitle(status), status, detail, instance };
    }
    // Never leak internal error messages to clients.
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    return {
      type: 'about:blank',
      title: problemTitle(status),
      status,
      detail: 'Произошла непредвиденная ошибка. Попробуйте позже.',
      instance,
    };
  }
}
