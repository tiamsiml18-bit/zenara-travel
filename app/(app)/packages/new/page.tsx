import { Topbar } from '@/components/layout/topbar';
import { PackageForm } from '@/components/packages/package-form';
import { requireRole } from '@/lib/auth/session';

export default async function NewPackagePage() {
  await requireRole('admin', 'manager');

  return (
    <>
      <Topbar title="New package" showBack />
      <main className="flex-1 overflow-y-auto p-6">
        <PackageForm mode="create" />
      </main>
    </>
  );
}
