import { expect, it } from 'vitest';
import { type FileStore, InvalidKeyError } from './storage';

/**
 * The contract every file store meets: memory, disk, S3 and the judge demo's Postgres store
 * (packages/db files.ts, exported as `@universityflow/documents/storage-contract`). Each store's test file runs it, so
 * the stand-ins can't promise what the real store doesn't do (D8).
 */
export function storageContract(make: () => Promise<FileStore>) {
  const file = { bytes: new Uint8Array([1, 2, 3, 4]), mimeType: 'image/jpeg' };

  it('returns what was put, and nothing after delete', async () => {
    const store = await make();
    await store.put('doc-00000001', file);
    expect(await store.get('doc-00000001')).toEqual(file);
    await store.delete('doc-00000001');
    expect(await store.get('doc-00000001')).toBeNull();
  });

  it('returns null for a key never stored, and deletes it quietly', async () => {
    const store = await make();
    expect(await store.get('doc-missing0')).toBeNull();
    await expect(store.delete('doc-missing0')).resolves.toBeUndefined();
  });

  it.each(['../escape', 'UPPER-CASE1', 'a/b/c-12345', 'short', ''])(
    'refuses the key %j',
    async (key) => {
      const store = await make();
      await expect(store.put(key, file)).rejects.toThrow(InvalidKeyError);
      await expect(store.get(key)).rejects.toThrow(InvalidKeyError);
    },
  );
}
