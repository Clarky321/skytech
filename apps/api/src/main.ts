import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

// Validated configuration (Zod) replaces this in Phase 2.1.
const DEFAULT_PORT = 4000;

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  const port = Number(process.env.API_PORT ?? DEFAULT_PORT);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}`);
}

await bootstrap();
