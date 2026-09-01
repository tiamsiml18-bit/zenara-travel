'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/session';
import { packageFormSchema, type PackageFormInput } from '@/lib/validation/package';
import * as packagesService from '@/lib/services/packages';

export type ActionResult = { ok: true; packageId: string } | { ok: false; error: string };

export async function createPackageAction(input: PackageFormInput): Promise<ActionResult> {
  const user = await requireRole('admin', 'manager');
  const parsed = packageFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid package details.' };
  }

  const supabase = await createSupabaseServerClient();
  // Same principle as Tours: the database write is the only thing that
  // determines success or failure. A package already safely saved must
  // never be reported as failed just because a secondary step below
  // (cache revalidation) hiccups.
  let packageId: string;
  try {
    packageId = await packagesService.createPackage(supabase, parsed.data, user.id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create package.' };
  }

  try {
    revalidatePath('/packages');
  } catch (err) {
    console.error('[packages] revalidatePath failed after a successful create — package was still saved', err);
  }
  return { ok: true, packageId };
}

export async function updatePackageAction(packageId: string, input: PackageFormInput): Promise<ActionResult> {
  const user = await requireRole('admin', 'manager');
  const parsed = packageFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid package details.' };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await packagesService.updatePackage(supabase, packageId, parsed.data, user.id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update package.' };
  }

  try {
    revalidatePath('/packages');
    revalidatePath(`/packages/${packageId}`);
  } catch (err) {
    console.error('[packages] revalidatePath failed after a successful update — package was still saved', err);
  }
  return { ok: true, packageId };
}

export async function togglePackageActiveAction(packageId: string, isActive: boolean) {
  const user = await requireRole('admin', 'manager');
  const supabase = await createSupabaseServerClient();
  await packagesService.setPackageActive(supabase, packageId, isActive, user.id);
  revalidatePath('/packages');
}

export async function redirectToPackage(packageId: string) {
  redirect(`/packages/${packageId}`);
}
