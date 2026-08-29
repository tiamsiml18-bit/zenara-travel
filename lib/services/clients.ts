import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClientInput } from '@/lib/validation/client';
import { writeAudit } from './audit';

const CLIENT_LIST_SELECT = `
  id, full_name, mobile_number, email, destination, travel_start_date, travel_end_date,
  quoted_price, created_at, updated_at,
  status:client_statuses ( id, name ),
  agent:users!clients_assigned_agent_id_fkey ( id, full_name )
`;

export interface ClientListFilters {
  search?: string;
  statusId?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}

export async function listClients(supabase: SupabaseClient, filters: ClientListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('clients')
    .select(CLIENT_LIST_SELECT, { count: 'exact' })
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (filters.search) {
    // Uses the pg_trgm GIN index defined in the schema — safe at scale.
    query = query.or(
      `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,mobile_number.ilike.%${filters.search}%`
    );
  }
  if (filters.statusId) query = query.eq('status_id', filters.statusId);
  if (filters.agentId) query = query.eq('assigned_agent_id', filters.agentId);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load clients: ${error.message}`);

  return { clients: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getClientById(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select(
      `*, status:client_statuses ( id, name ), source:client_sources ( id, name ),
       agent:users!clients_assigned_agent_id_fkey ( id, full_name )`
    )
    .eq('id', clientId)
    .is('deleted_at', null)
    .single();

  if (error) throw new Error(`Client not found: ${error.message}`);
  return data;
}

export async function getClientTimeline(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from('client_activities')
    .select(
      `id, activity_type, description, created_at, related_quotation_id,
       user:users ( id, full_name )`
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load timeline: ${error.message}`);
  return data ?? [];
}

export async function getClientNotes(supabase: SupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from('client_notes')
    .select(`id, note, created_at, author:users ( id, full_name )`)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load notes: ${error.message}`);
  return data ?? [];
}

function toDbRow(input: ClientInput) {
  return {
    full_name: input.fullName,
    mobile_number: input.mobileNumber || null,
    email: input.email || null,
    messenger_handle: input.messengerHandle || null,
    instagram_handle: input.instagramHandle || null,
    whatsapp_number: input.whatsappNumber || null,
    source_id: input.sourceId,
    destination: input.destination || null,
    travel_start_date: input.travelStartDate || null,
    travel_end_date: input.travelEndDate || null,
    num_adults: input.numAdults,
    num_children: input.numChildren,
    quoted_price: input.quotedPrice ?? null,
    status_id: input.statusId,
    assigned_agent_id: input.assignedAgentId,
    notes: input.notes || null,
  };
}

export async function createClient(
  supabase: SupabaseClient,
  input: ClientInput,
  actingUserId: string
) {
  const { data, error } = await supabase.from('clients').insert(toDbRow(input)).select('id').single();
  if (error) throw new Error(`Failed to create client: ${error.message}`);

  await supabase.from('client_activities').insert({
    client_id: data.id,
    activity_type: 'client_created',
    description: `Client created by agent.`,
    user_id: actingUserId,
  });

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'client.created',
    entityType: 'client',
    entityId: data.id,
  });

  return data.id as string;
}

export async function updateClient(
  supabase: SupabaseClient,
  clientId: string,
  input: ClientInput,
  actingUserId: string
) {
  const { error } = await supabase.from('clients').update(toDbRow(input)).eq('id', clientId);
  if (error) throw new Error(`Failed to update client: ${error.message}`);

  await writeAudit(supabase, {
    userId: actingUserId,
    action: 'client.updated',
    entityType: 'client',
    entityId: clientId,
  });
}

export async function addClientNote(
  supabase: SupabaseClient,
  clientId: string,
  note: string,
  actingUserId: string
) {
  const { error } = await supabase
    .from('client_notes')
    .insert({ client_id: clientId, note, author_id: actingUserId });
  if (error) throw new Error(`Failed to add note: ${error.message}`);

  await supabase.from('client_activities').insert({
    client_id: clientId,
    activity_type: 'note_added',
    description: note.length > 140 ? `${note.slice(0, 140)}\u2026` : note,
    user_id: actingUserId,
  });
}

export async function setClientStatusByName(
  supabase: SupabaseClient,
  clientId: string,
  statusName: string,
  actingUserId: string,
  description?: string
) {
  const { data: status } = await supabase
    .from('client_statuses')
    .select('id')
    .eq('name', statusName)
    .single();
  if (!status) return;

  const { error } = await supabase.from('clients').update({ status_id: status.id }).eq('id', clientId);
  if (error) throw new Error(`Failed to update client status: ${error.message}`);

  await supabase.from('client_activities').insert({
    client_id: clientId,
    activity_type: 'client_status_changed',
    description: description ?? `Status changed to ${statusName}.`,
    user_id: actingUserId,
  });
}
