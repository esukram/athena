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
    });
  });

  it('returns undefined for an unknown lecture', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repository = createLectureRepository(db);
    expect(repository.update('missing', { title: 'x' })).toBeUndefined();
  });
});
