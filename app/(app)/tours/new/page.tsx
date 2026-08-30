import { Topbar } from '@/components/layout/topbar';
import { TourForm } from '@/components/tours/tour-form';
import { requireRole } from '@/lib/auth/session';

export default async function NewTourPage() {
  await requireRole('admin', 'manager');

  return (
    <>
      <Topbar title="New tour" showBack />
      <main className="flex-1 overflow-y-auto p-6">
        <TourForm mode="create" />
      </main>
    </>
  );
}
