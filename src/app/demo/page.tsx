import { AppShell } from '@/components/app-shell';
import { AppView, sections } from '@/components/app-view';
export const metadata = { title: 'Explorá la plataforma' };
export default async function Demo({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const section = view && sections.includes(view) ? view : 'dashboard';
  return (
    <AppShell active={section} demo>
      <AppView section={section} />
    </AppShell>
  );
}
