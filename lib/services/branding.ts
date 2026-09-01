import type { SupabaseClient } from '@supabase/supabase-js';
import { writeAudit } from './audit';

const BUCKET = 'branding';

/**
 * Determines the real image format from the file's own bytes (its magic
 * number), never from what the browser reports as file.type. A file's
 * reported MIME type can be wrong or inconsistent depending on how it was
 * saved, renamed, or handled before upload -- if that mismatched type is
 * then used as the served Content-Type header, the actual bytes and the
 * declared format disagree. Most viewers tolerate that (they sniff the
 * real bytes anyway), but stricter consumers -- notably Gmail's image
 * proxy -- can reject or fail to render a file whose declared type
 * doesn't match its content. Checking the real signature here is what
 * guarantees the served Content-Type is always correct.
 */
export function detectImageFormat(bytes: Uint8Array): 'png' | 'jpeg' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  return null;
}

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
  const bytes = new Uint8Array(await file.arrayBuffer());
  const realFormat = detectImageFormat(bytes);
  if (!realFormat) {
    throw new Error('This file does not look like a valid JPEG or PNG image — try a different file.');
  }
  const ext = realFormat === 'png' ? 'png' : 'jpg';
  const contentType = realFormat === 'png' ? 'image/png' : 'image/jpeg';
  const path = `logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
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
