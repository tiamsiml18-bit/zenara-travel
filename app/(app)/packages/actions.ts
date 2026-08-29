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
  try {
    const packageId = await packagesService.createPackage(supabase, parsed.data, user.id);
    revalidatePath('/packages');
    return { ok: true, packageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create package.' };
  }
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
    revalidatePath('/packages');
    revalidatePath(`/packages/${packageId}`);
    return { ok: true, packageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update package.' };
  }
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
