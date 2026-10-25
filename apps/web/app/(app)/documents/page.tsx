import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { DocumentsView } from './documents-view';

export const metadata: Metadata = { title: en.documents.title };

export default async function DocumentsPage() {
  const signed = await readyStudent();
  const [documents, profile] = await Promise.all([
    signed.student.documents(),
    signed.student.profile(),
  ]);
  const { uploads, config } = await getServices();
  return (
    <DocumentsView
      direct={uploads !== null}
      demo={config.demo}
      grade={profile?.grade ?? null}
      documents={documents.map((d) => ({
        id: d.id,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
