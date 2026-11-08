import { HttpException, HttpStatus } from '@nestjs/common';
import type { ProblemDetails } from '@skytech/contracts';

const TITLES: Record<number, string> = {
  400: 'Некорректный запрос',
  401: 'Требуется вход',
  403: 'Доступ запрещён',
  404: 'Не найдено',
  409: 'Конфликт',
  413: 'Слишком большой файл',
  415: 'Неподдерживаемый формат',
  422: 'Ошибка валидации',
  429: 'Слишком много запросов',
  500: 'Внутренняя ошибка сервера',
  503: 'Сервис временно недоступен',
};

export function problemTitle(status: number): string {
  return TITLES[status] ?? 'Ошибка';
}

/** Throw to return an RFC 9457 response with a specific detail and optional field errors. */
export class ProblemException extends HttpException {
  constructor(
    status: HttpStatus,
    detail: string,
    readonly errors?: ProblemDetails['errors'],
    readonly code?: string,
  ) {
    super(detail, status);
  }
}

export const notFound = (detail = 'Объект не найден') =>
  new ProblemException(HttpStatus.NOT_FOUND, detail);
export const forbidden = (detail = 'Недостаточно прав для этого действия') =>
  new ProblemException(HttpStatus.FORBIDDEN, detail);
export const conflict = (detail: string, errors?: ProblemDetails['errors'], code?: string) =>
  new ProblemException(HttpStatus.CONFLICT, detail, errors, code);
export const unprocessable = (detail: string, errors?: ProblemDetails['errors']) =>
  new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, detail, errors);
