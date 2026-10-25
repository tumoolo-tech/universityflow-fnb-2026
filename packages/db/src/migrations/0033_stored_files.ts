/**
 * Migration 0033: files kept in the database, for a judge demo on Postgres only
 * (docs/deploy/demo.md, `PostgresFileStore` in files.ts). The demo has no S3, and each serverless
 * instance has its own /tmp, so a sample report or sample photo kept on disk by one instance was
 * missing on the next request. Production keeps files in S3 only and never writes here.
 * (0035 is the CV core's, built beside this one.) Append-only.
 */
export const sql = `-- A key the app made (the same rule as every file store, packages/documents assertKey), the
-- file's media type, and its bytes: at most the upload limit, 10 MiB (MAX_UPLOAD_BYTES). Nothing
-- else: no name, no learner id, no text read from the file. A row goes when the app deletes its
-- key, with the document, the photo, the judge's copy or the account.
create table stored_files (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9-]{7,127}$'),
  mime_type text not null check (mime_type ~ '^[a-z]+/[a-z0-9][a-z0-9.+-]{0,99}$'),
  bytes bytea not null check (octet_length(bytes) <= 10485760),
  created_at timestamptz not null default now()
);

-- Written and read by the owner role (the server), never by a learner's request: no policy and
-- no grant to uf_app.
alter table stored_files enable row level security;
`;
