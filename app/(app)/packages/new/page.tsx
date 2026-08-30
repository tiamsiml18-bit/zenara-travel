import { Topbar } from '@/components/layout/topbar';
import { PackageForm } from '@/components/packages/package-form';
import { createClient } from '@/lib/supabase/server';
import { listToursForPicker } from '@/lib/services/tours';
import { requireRole } from '@/lib/auth/session';

export default async function NewPackagePage() {
  await requireRole('admin', 'manager');
  const supabase = await createClient();
  const tours = await listToursForPicker(supabase);

  return (
    <>
      <Topbar title="New package" showBack />
      <main className="flex-1 overflow-y-auto p-6">
        <PackageForm mode="create" tours={tours} />
      </main>
    </>
  );
}
