import { Topbar } from '@/components/layout/topbar';
import { PackageForm } from '@/components/packages/package-form';
import { createClient } from '@/lib/supabase/server';
import { getPackageById } from '@/lib/services/packages';
import { listToursForPicker } from '@/lib/services/tours';
import { requireUser } from '@/lib/auth/session';

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const [{ package: pkg, itinerary, inclusions, exclusions }, tours] = await Promise.all([
    getPackageById(supabase, id),
    listToursForPicker(supabase),
  ]);

  const canManage = user.role === 'admin' || user.role === 'manager';

  return (
    <>
      <Topbar title={pkg.name} showBack />
      <main className="flex-1 overflow-y-auto p-6">
        {canManage ? (
          <PackageForm
            mode="edit"
            packageId={id}
            tours={tours}
            initialData={{
              name: pkg.name,
              destination: pkg.destination,
              numDays: pkg.num_days,
              numNights: pkg.num_nights,
              defaultNotes: pkg.default_notes ?? '',
              isActive: pkg.is_active,
              packageType: pkg.package_type,
              itinerary,
              inclusions,
              exclusions,
            }}
          />
        ) : (
          <div className="max-w-3xl rounded-lg border border-sand-200 bg-white p-6 text-sm text-ink-500">
            You have view-only access to package templates. Contact an admin or manager to make changes.
          </div>
        )}
      </main>
    </>
  );
}
