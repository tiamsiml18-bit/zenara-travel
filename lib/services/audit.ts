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
