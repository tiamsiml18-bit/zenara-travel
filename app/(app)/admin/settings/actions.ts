'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { updateAgencySettings } from '@/lib/services/lookups';
import { writeAudit } from '@/lib/services/audit';

export async function updateAgencySettingsAction(id: string, formData: FormData) {
  const user = await requireRole('admin');
  const supabase = await createSupabaseServerClient();

  const field = (name: string) => (formData.get(name) as string | null)?.trim() || null;

  const agencyName = field('agencyName');
  if (!agencyName) {
    redirect(`/admin/settings?error=${encodeURIComponent('Agency name is required.')}`);
  }

  try {
    await updateAgencySettings(supabase, id, {
      agencyName,
      logoUrl: field('logoUrl'),
      phone: field('phone'),
      email: field('email'),
      facebook: field('facebook'),
      instagram: field('instagram'),
      whatsapp: field('whatsapp'),
      messenger: field('messenger'),
      website: field('website'),
      address: field('address'),
      quotationFooter: field('quotationFooter'),
      termsAndConditions: field('termsAndConditions'),
      paymentInstructions: field('paymentInstructions'),
      defaultCurrency: field('defaultCurrency') ?? 'PHP',
      quotationNumberPrefix: field('quotationNumberPrefix') ?? 'QT',
    });
    await writeAudit(supabase, { userId: user.id, action: 'settings.updated', entityType: 'agency_settings', entityId: id });
    revalidatePath('/admin/settings');
  } catch (err) {
    redirect(`/admin/settings?error=${encodeURIComponent(err instanceof Error ? err.message : 'Failed to save settings.')}`);
  }

  redirect('/admin/settings?saved=1');
}
