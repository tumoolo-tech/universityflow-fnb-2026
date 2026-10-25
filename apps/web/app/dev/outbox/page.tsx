import { en } from '@universityflow/content';
import { notFound } from 'next/navigation';
import { getServices } from '@/lib/server/services';

export const dynamic = 'force-dynamic';

/** Local development only: what the SMS stand-in would have sent. */
export default async function OutboxPage() {
  const { outbox, config } = await getServices();
  if (!outbox || config.production || config.demo) notFound();
  return (
    <main id="main" className="mx-auto max-w-prose px-5 py-8">
      <h1 className="mb-2 text-2xl">{en.dev.outboxTitle}</h1>
      <p className="mb-4 text-muted">{en.auth.devOutbox}</p>
      <ol className="flex flex-col gap-3">
        {outbox.all().map((m) => (
          <li key={m.id} className="rounded-md bg-surface p-3">
            <p className="text-sm text-muted">
              {m.to} · {m.at.toISOString()}
            </p>
            <p data-testid="sms-body">{m.body}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
