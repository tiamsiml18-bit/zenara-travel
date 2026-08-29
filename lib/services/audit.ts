import type { SupabaseClient } from '@supabase/supabase-js';

export async function writeAudit(
  supabase: SupabaseClient,
  params: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? null,
  });

  // Audit failures should never block the user's actual operation, but we
  // do want visibility — surface to server logs rather than throwing.
  if (error) {
    console.error('[audit] failed to write audit log', { params, error });
  }
}

/**
 * Compares two flat field maps and returns only what actually changed —
 * the basis for "Leo changed the travel date. Old: Dec 24 → New: Dec 26"
 * style audit entries. Used for routine edits that don't need a
 * confirmation popup but still need to be accountable in Audit History
 * (per the "normal edit: Edit → Save → Audit" rule) — this is what makes
 * that possible without hand-writing a diff at every call site.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  labels: Partial<Record<keyof T, string>>
): { field: string; label: string; from: unknown; to: unknown }[] {
  const changes: { field: string; label: string; from: unknown; to: unknown }[] = [];
  for (const key of Object.keys(labels) as (keyof T)[]) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    const changed = a instanceof Date || b instanceof Date ? String(a) !== String(b) : JSON.stringify(a) !== JSON.stringify(b);
    if (changed) {
      changes.push({ field: String(key), label: labels[key] as string, from: a, to: b });
    }
  }
  return changes;
}

/**
 * Writes one audit entry per changed field, in the "Old → New" shape the
 * client history view is meant to render. No-ops (writes nothing) when
 * nothing actually changed, so routine "Save" clicks that didn't touch
 * anything don't create noise in the history.
 */
export async function writeFieldChangeAudit(
  supabase: SupabaseClient,
  params: {
    userId: string;
    entityType: string;
    entityId: string;
    changes: { field: string; label: string; from: unknown; to: unknown }[];
  }
) {
  if (params.changes.length === 0) return;
  await writeAudit(supabase, {
    userId: params.userId,
    action: `${params.entityType}.updated`,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: { changes: params.changes },
  });
}
