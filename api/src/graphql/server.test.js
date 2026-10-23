import jwt from 'jsonwebtoken';
import { afterAll, describe, expect, it } from 'vitest';
import { config } from '../config.js';
import { pool } from '../db/client.js';
import { mongo, mongoDb } from '../db/mongo.js';
import { yoga } from './server.js';

// Frågar yoga direkt via yoga.fetch – ingen server, ingen port, men hela kedjan:
// context, resolvers, loaders, riktig Postgres och riktig MongoDB.
const graphql = async (query, { variables, token } = {}) => {
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ query, variables }),
  });
  return { status: response.status, ...(await response.json()) };
};

afterAll(async () => {
  await pool.end();
  await mongo.close();
});

describe('GraphQL-API:et mot riktiga databaser', () => {
  it('turlistan ger 50 turer och alla har ett namn på den som gick, med högst 2 databasfrågor', async () => {
    const { data, extensions } = await graphql('query Turer { tours { title user { displayName } } }');
    expect(data.tours).toHaveLength(50);
    expect(data.tours.every((t) => t.user.displayName.length > 0)).toBe(true);
    expect(extensions.databasfragor).toBeLessThanOrEqual(2);
  });

  it('en guide som inte finns ger null, inte ett fel', async () => {
    const { status, data, errors } = await graphql('query Saknas { guide(slug: "finns-inte") { title } }');
    expect(status).toBe(200);
    expect(data.guide).toBeNull();
    expect(errors).toBeUndefined();
  });

  it('ett fält som inte finns ger errors, och ändå statuskod 200', async () => {
    const { status, errors } = await graphql('query { tours { finnsInte } }');
    expect(status).toBe(200);
    expect(errors).toHaveLength(1);
  });

  const createTour = 'mutation NyTur { createTour(input: { title: "Testtur", startedAt: "2026-10-23T08:00:00Z", distanceM: 1000 }) { id title user { id } } }';

  it('createTour utan token nekas med koden UNAUTHENTICATED', async () => {
    const { errors, data } = await graphql(createTour);
    expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
    expect(data).toBeNull();
  });

  it('createTour med token skapar turen i den inloggades namn', async () => {
    const { rows } = await pool.query('select id from users order by id limit 1');
    const token = jwt.sign({ id: rows[0].id }, config.jwtSecret);
    const { data, errors } = await graphql(createTour, { token });
    try {
      expect(errors).toBeUndefined();
      expect(data.createTour.title).toBe('Testtur');
      expect(Number(data.createTour.user.id)).toBe(rows[0].id);
    } finally {
      if (data?.createTour) await pool.query('delete from tours where id = $1', [data.createTour.id]);
    }
  });

  it('mätpunkterna kommer från MongoDB och är lika många som raderna i Postgres', async () => {
    const pg = Number((await pool.query('select count(*) from tour_logs')).rows[0].count);
    const [{ n }] = await mongoDb()
      .collection('tours')
      .aggregate([{ $group: { _id: null, n: { $sum: { $size: '$logs' } } } }])
      .toArray();
    expect(pg).toBeGreaterThan(0);
    expect(n).toBe(pg);
    const { data } = await graphql('query { tours(limit: 5) { logs { lat lon } } }');
    expect(data.tours.some((t) => t.logs.length > 0)).toBe(true);
  });
});
