import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { runMigrations } from './migration.js';
import { createLectureRepository } from './repositories.js';

describe('createLectureRepository update', () => {
  it('applies a partial patch, leaving other fields intact', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    db.prepare(
      'INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)',
    ).run('lecture-a', 'Original Title', 'Original Description');

    const repository = createLectureRepository(db);
    const updated = repository.update('lecture-a', { title: 'New Title' });

    expect(updated).toEqual({
      id: 'lecture-a',
      title: 'New Title',
      description: 'Original Description',
      order: 0,
    });
  });

  it('returns undefined for an unknown lecture', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repository = createLectureRepository(db);
    expect(repository.update('missing', { title: 'x' })).toBeUndefined();
  });
});

describe('createLectureRepository ordering', () => {
  it('creates the first lecture at zero and appends subsequent lectures', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repository = createLectureRepository(db);

    const first = repository.create({
      title: 'First',
      description: 'First description',
    });
    const second = repository.create({
      title: 'Second',
      description: 'Second description',
    });
    const third = repository.create({
      title: 'Third',
      description: 'Third description',
    });

    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
    expect(third.order).toBe(2);
  });

  it('persists an order update without changing other fields', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    db.prepare(
      'INSERT INTO lectures (id, title, description, "order") VALUES (?, ?, ?, ?)',
    ).run('lecture-a', 'Original Title', 'Original Description', 0);

    const repository = createLectureRepository(db);
    const updated = repository.update('lecture-a', { order: 4 });

    expect(updated).toEqual({
      id: 'lecture-a',
      title: 'Original Title',
      description: 'Original Description',
      order: 4,
    });
    expect(repository.getById('lecture-a')).toEqual(updated);
  });

  it('returns lectures sorted by order', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    db.prepare(
      'INSERT INTO lectures (id, title, description, "order") VALUES (?, ?, ?, ?)',
    ).run('lecture-a', 'A', 'Description A', 2);
    db.prepare(
      'INSERT INTO lectures (id, title, description, "order") VALUES (?, ?, ?, ?)',
    ).run('lecture-b', 'B', 'Description B', 0);
    db.prepare(
      'INSERT INTO lectures (id, title, description, "order") VALUES (?, ?, ?, ?)',
    ).run('lecture-c', 'C', 'Description C', 1);

    const repository = createLectureRepository(db);
    expect(repository.getAll().map((lecture) => lecture.id)).toEqual([
      'lecture-b',
      'lecture-c',
      'lecture-a',
    ]);
  });
});
