# База данных

PostgreSQL 17, Drizzle ORM (`apps/api/src/db/schema/*`), миграции в `apps/api/drizzle/`
(создаются `drizzle-kit generate`). Все времена — `timestamptz` (UTC), ключи — `uuid`.

## Таблицы по модулям

| Модуль   | Таблица             | Назначение                                                                 |
| -------- | ------------------- | -------------------------------------------------------------------------- |
| users    | `users`             | сотрудники: email (нижний регистр, unique), Argon2id-хэш, роль, активность |
| auth     | `sessions`          | серверные сессии: **только SHA-256 токена**, срок, IP, user agent          |
| authors  | `author_profiles`   | публичные профили авторов (`user_id` — необязательная связь со staff)      |
| taxonomy | `categories`        | дерево глубиной 2 (`parent_id`, restrict), slug глобально уникален         |
| taxonomy | `tags`              | теги, slug unique                                                          |
| media    | `media`             | изображения: размеры, SHA-256 (дедупликация), варианты WebP в S3 (`jsonb`) |
| content  | `content`           | материал: тип, статус, `version` (optimistic lock), ссылки на ревизии      |
| content  | `content_revisions` | **неизменяемые** снимки: JSON-документ + HTML/TOC/plain text               |
| content  | `content_tags`      | теги опубликованной ревизии (для публичных списков)                        |
| content  | `revision_media`    | какие медиа использует ревизия (FK `restrict` защищает от удаления)        |
| content  | `redirects`         | 301 со старых адресов после смены slug                                     |
| platform | `audit_log`         | журнал изменяющих действий (в той же транзакции)                           |
| platform | `outbox_events`     | transactional outbox (`content.published`, `content.unpublished`)          |

## Модель контента

```
content ──draft_revision_id──────▶ content_revisions (то, что в редакторе)
        └─published_revision_id──▶ content_revisions (то, что на сайте)
```

- Каждое сохранение создаёт новую ревизию; ревизии не изменяются и не удаляются.
- Публикация = `published_revision_id := draft_revision_id`, `published_slug := revision.slug`.
- Правка опубликованного материала меняет только `draft_revision_id`; сайт не меняется до публикации.
- `slug` (черновика) уникален в пределах типа; `published_slug` — тоже (частичный уникальный индекс).
- Ссылки ревизии на категорию/теги/автора/обложку — обычные id без FK: история не должна меняться при
  удалении справочников. Удаление используемых категорий/тегов/авторов запрещено на уровне сервиса.
- `body` — SkyTech-документ (ADR 0002), `body_schema_version` — версия схемы документа.

## Правила

- Только `drizzle-kit generate` + `drizzle-kit migrate` (или `pnpm db:migrate`). `push` запрещён.
- Применённые миграции не редактируются; изменения — новой миграцией.
- Модуль работает только со своими таблицами; чужие данные — через сервис модуля
  (`ContentStatsService` отвечает другим модулям на вопросы о контенте).
