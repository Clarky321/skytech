import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';

describe('API smoke', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<Server>>());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('boots and answers HTTP under the /api prefix', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/not-implemented-yet');
    expect(res.status).toBe(404);
  });
});
