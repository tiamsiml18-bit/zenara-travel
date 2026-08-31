import { Topbar } from '@/components/layout/topbar';
import { TourForm } from '@/components/tours/tour-form';
import { createClient } from '@/lib/supabase/server';
import { getTourById } from '@/lib/services/tours';
import { requireUser } from '@/lib/auth/session';

export default async function TourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const tour = await getTourById(supabase, id);

  const canManage = user.role === 'admin' || user.role === 'manager';

  return (
    <>
      <Topbar title={tour.name} showBack />
      <main className="flex-1 overflow-y-auto p-6">
        {canManage ? (
          <TourForm
            mode="edit"
            tourId={id}
            initialData={{
              name: tour.name,
              destination: tour.destination ?? '',
              description: tour.description ?? '',
              activities: tour.activities ?? [],
              defaultInclusions: tour.default_inclusions ?? [],
              defaultExclusions: tour.default_exclusions ?? [],
              priceSenior: tour.price_senior,
              priceAdult: tour.price_adult,
              priceChild: tour.price_child,
              priceInfant: tour.price_infant,
              pricePwd: tour.price_pwd,
              groupCost: tour.group_cost,
              ageRangeSenior: tour.age_range_senior ?? '',
              ageRangeAdult: tour.age_range_adult ?? '',
              ageRangeChild: tour.age_range_child ?? '',
              ageRangeInfant: tour.age_range_infant ?? '',
              ageRangePwd: tour.age_range_pwd ?? '',
              tourType: tour.tour_type,
            }}
          />
        ) : (
          <div className="max-w-2xl rounded-lg border border-sand-200 bg-white p-6 text-sm text-ink-500">
            You have view-only access to the tours library. Contact an admin or manager to make changes.
          </div>
        )}
      </main>
    </>
  );
}
