import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';

interface ProblemDetails {
  type: 'about:blank';
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: string[];
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const problem: ProblemDetails = {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      detail: this.detailFor(exception),
      instance: request.originalUrl ?? request.url,
    };

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        const message = (payload as { message?: unknown }).message;
        if (Array.isArray(message)) {
          problem.errors = message.filter(
            (item): item is string => typeof item === 'string',
          );
        }
      }
    }

    response.status(status).type('application/problem+json').json(problem);
  }

  private detailFor(exception: unknown): string {
    if (!(exception instanceof HttpException)) {
      return 'An unexpected error occurred.';
    }
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return payload;
    }
    if (typeof payload === 'object' && payload !== null) {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return 'Request validation failed.';
      }
    }
    return exception.message;
  }
}
