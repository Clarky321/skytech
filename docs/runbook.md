# Runbook — SkyTech.ru

Команды проверены в Windows PowerShell; в bash они те же.

## Требования

- Node.js 24 LTS, pnpm (`corepack enable` — версия берётся из `package.json`).
- Docker Desktop (Engine запущен).

## Первый запуск

```powershell
pnpm install
Copy-Item .env.example .env        # локальные настройки (в git не попадает)
pnpm infra:up                      # PostgreSQL 17, Redis 7, MinIO (+ политика бакетов)
pnpm db:migrate                    # применить миграции (drizzle-kit migrate)
pnpm user:create --email admin@skytech.local --name "Администратор" --role admin
#   → пароль генерируется и показывается ОДИН раз. Сохраните его.
pnpm db:seed                       # категории, теги, автор «Редакция SkyTech», 3 статьи (нужен admin)
pnpm dev                           # сайт http://localhost:3000, API http://localhost:4000
```

Админка: <http://localhost:3000/admin> → вход под созданной учётной записью.

Запланированная публикация работает только при запущенном worker (отдельный терминал, после того как
`pnpm dev` собрал API):

```powershell
pnpm dev:worker
```

## Учётные записи

| Задача                       | Команда                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Создать сотрудника           | `pnpm user:create --email … --name "…" --role admin\|editor\|author` |
| Задать свой пароль (без эха) | `"пароль-не-короче-12" \| pnpm user:create … --password-stdin`       |
| Сбросить пароль              | `pnpm user:reset-password --email …` (все сеансы завершаются)        |

Публичной регистрации нет. Пароли хранятся как Argon2id, сессии — как SHA-256 токена.

## Первая статья

1. `/admin` → «Новая статья» → название → «Создать и открыть редактор».
2. Текст: `/` открывает меню блоков (`/heading`, `/code`, `/table`, `/warning`, `/info`, `/image`,
   `/quote`, `/checklist`…). Выделение текста — панель форматирования. Слева от блока — «+» и ручка
   (меню «вверх/вниз/превратить в/дублировать/удалить», перетаскивание).
3. Справа: категория, автор, теги, обложка, SEO. Slug создаётся из заголовка.
4. `Ctrl+S` — сохранить (появится «Сохранено в ЧЧ:ММ» только после ответа сервера).
5. «Предпросмотр» — откроется вкладка с публичным оформлением черновика.
6. «Опубликовать» — статья появится на `/articles/<slug>` и в списках.

## База данных

```powershell
pnpm db:generate   # после изменения apps/api/src/db/schema/* — создаёт SQL-миграцию
pnpm db:migrate    # применить миграции
pnpm db:reset      # ТОЛЬКО dev: удалить всё и применить миграции заново
```

`drizzle-kit push` запрещён. Применённые миграции не редактируются — только новые.

## Проверки

```powershell
pnpm check         # формат, lint, typecheck, unit + integration тесты, сборка (как CI)
pnpm e2e           # Playwright: отдельный стек на портах 3100/4100, БД skytech_e2e
```

Интеграционные тесты API используют реальные PostgreSQL (`skytech_test`), Redis (DB 1) и MinIO
(бакет `skytech-media-test`) — инфраструктура должна быть запущена (`pnpm infra:up`).

## Инфраструктура

| Сервис     | Адрес                   | Учётные данные (только dev)      |
| ---------- | ----------------------- | -------------------------------- |
| PostgreSQL | `localhost:5432`        | `skytech` / `skytech`            |
| Redis      | `localhost:6379`        | —                                |
| MinIO API  | `http://localhost:9000` | `skytech` / `skytech-dev-secret` |
| MinIO UI   | `http://localhost:9001` | те же                            |

Бакеты `skytech-media` и `skytech-media-test`: анонимно разрешено только чтение объекта по точному
ключу (`s3:GetObject`), листинг запрещён (`docker/minio/public-read-policy.sh`). В production такую
же политику нужно настроить в Object Storage провайдера.

```powershell
pnpm infra:logs    # логи контейнеров
pnpm infra:down    # остановить
pnpm infra:reset   # остановить и УДАЛИТЬ данные (volumes)
```

## Неполадки

| Симптом                                         | Что проверить                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `Invalid configuration` при старте API          | нет `.env` или переменной — сравните с `.env.example`                                 |
| `/api/health/ready` → 503                       | `pnpm infra:up`, контейнеры `healthy` (`docker compose -f docker/compose.dev.yml ps`) |
| Вход: «Слишком много попыток»                   | 5 неудачных попыток на email за 15 минут; подождите или очистите Redis                |
| Запрос отклонён: «недопустимый источник (CSRF)» | открывайте сайт по адресу из `APP_ORIGIN` (по умолчанию `http://localhost:3000`)      |
| Картинки не показываются                        | `NEXT_PUBLIC_MEDIA_URL`/`S3_PUBLIC_URL`, политика бакета (`pnpm infra:up` применяет)  |
| «Есть несохранённые изменения» после сбоя       | при открытии редактор предложит восстановить локальную копию                          |
