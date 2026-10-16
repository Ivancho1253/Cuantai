import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { AppView, sections } from '@/components/app-view';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Workspace', robots: { index: false, follow: false } };
export default async function WorkspacePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  const session = await getSession(await headers());
  if (!session) redirect('/login');
  return (
    <AppShell active={section} user={session.user}>
      <AppView section={section} />
    </AppShell>
  );
}
