'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { updateAgencySettings } from '@/lib/services/lookups';
import { uploadAgencyLogo, removeAgencyLogo } from '@/lib/services/branding';
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
      // Entered as a percentage (e.g. "2.9") for readability, stored as a
      // fraction (0.029) since that's what the pricing formulas expect.
      creditCardFeePct: Number(field('creditCardFeePct') ?? 2.9) / 100,
      paypalFeePct: Number(field('paypalFeePct') ?? 3.9) / 100,
    });
    await writeAudit(supabase, { userId: user.id, action: 'settings.updated', entityType: 'agency_settings', entityId: id });
    revalidatePath('/admin/settings');
  } catch (err) {
    redirect(`/admin/settings?error=${encodeURIComponent(err instanceof Error ? err.message : 'Failed to save settings.')}`);
  }

  redirect('/admin/settings?saved=1');
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png']);

export async function uploadLogoAction(
  agencySettingsId: string,
  formData: FormData
): Promise<{ ok: true; logoUrl: string } | { ok: false; error: string }> {
  const user = await requireRole('admin');
  const supabase = await createSupabaseServerClient();

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an image file first.' };
  }
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return { ok: false, error: 'Logo must be a JPEG or PNG image.' };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: 'Logo must be smaller than 5MB.' };
  }

  try {
    const logoUrl = await uploadAgencyLogo(supabase, agencySettingsId, file, user.id);
    revalidatePath('/admin/settings');
    return { ok: true, logoUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to upload logo.' };
  }
}

export async function removeLogoAction(agencySettingsId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole('admin');
  const supabase = await createSupabaseServerClient();
  try {
    await removeAgencyLogo(supabase, agencySettingsId, user.id);
    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to remove logo.' };
  }
}
