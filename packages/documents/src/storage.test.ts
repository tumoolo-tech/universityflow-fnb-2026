import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe } from 'vitest';
import { DiskFileStore, MemoryFileStore } from './storage';
import { storageContract } from './storage.contract';

describe('MemoryFileStore', () => {
  storageContract(async () => new MemoryFileStore());
});

describe('DiskFileStore', () => {
  const roots: string[] = [];
  afterAll(async () => {
    for (const root of roots) await rm(root, { recursive: true, force: true });
  });
  storageContract(async () => {
    const root = await mkdtemp(join(tmpdir(), 'uf-store-'));
    roots.push(root);
    return new DiskFileStore(root);
  });
});
