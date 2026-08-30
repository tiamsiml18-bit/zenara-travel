import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';

const BUCKET = 'branding';

/**
 * Uploads a new logo (JPEG or PNG), replacing whatever was there before.
 * Each upload gets its own timestamped filename rather than overwriting a
 * fixed path — avoids any CDN/browser caching showing a stale logo right
 * after "Replace," at the small cost of leaving old logo files in storage
 * (harmless for a single small file that changes rarely).
 */
export async function uploadAgencyLogo(
  supabase: SupabaseClient,
  agencySettingsId: string,
  file: File,
  actingUserId: string
) {
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
  });
  if (uploadError) throw new Error(`Failed to upload logo: ${uploadError.message}`);

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabase
    .from('agency_settings')
    .update({ logo_url: publicUrlData.publicUrl })
    .eq('id', agencySettingsId);
  if (updateError) throw new Error(`Failed to save logo: ${updateError.message}`);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'agency_settings.logo_uploaded',
    entityType: 'agency_settings',
    entityId: agencySettingsId,
  });

  return publicUrlData.publicUrl;
}

export async function removeAgencyLogo(supabase: SupabaseClient, agencySettingsId: string, actingUserId: string) {
  const { error } = await supabase.from('agency_settings').update({ logo_url: null }).eq('id', agencySettingsId);
  if (error) throw new Error(`Failed to remove logo: ${error.message}`);

  // The old file itself is left in storage (see note on uploadAgencyLogo) —
  // removing just detaches it from agency_settings, which is what actually
  // controls whether the PDF/watermark uses it.
  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'agency_settings.logo_removed',
    entityType: 'agency_settings',
    entityId: agencySettingsId,
  });
}
