import type { SupabaseClient } from '@supabase/supabase-js';

export async function listClientStatuses(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('client_statuses')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listClientSources(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('client_sources')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listConsultants(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('agency_consultants')
    .select('id, full_name, title')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listAgents(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('is_active', true)
    .order('full_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAgencySettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('agency_settings').select('*').limit(1).single();
  if (error) throw new Error(`Failed to load agency settings: ${error.message}`);
  return data;
}

export async function updateAgencySettings(
  supabase: SupabaseClient,
  id: string,
  updates: {
    agencyName: string;
    logoUrl: string | null;
    phone: string | null;
    email: string | null;
    facebook: string | null;
    instagram: string | null;
    whatsapp: string | null;
    messenger: string | null;
    website: string | null;
    address: string | null;
    quotationFooter: string | null;
    termsAndConditions: string | null;
    paymentInstructions: string | null;
    defaultCurrency: string;
    quotationNumberPrefix: string;
  }
) {
  const { error } = await supabase
    .from('agency_settings')
    .update({
      agency_name: updates.agencyName,
      logo_url: updates.logoUrl,
      phone: updates.phone,
      email: updates.email,
      facebook: updates.facebook,
      instagram: updates.instagram,
      whatsapp: updates.whatsapp,
      messenger: updates.messenger,
      website: updates.website,
      address: updates.address,
      quotation_footer: updates.quotationFooter,
      terms_and_conditions: updates.termsAndConditions,
      payment_instructions: updates.paymentInstructions,
      default_currency: updates.defaultCurrency,
      quotation_number_prefix: updates.quotationNumberPrefix,
    })
    .eq('id', id);
  if (error) throw new Error(`Failed to update agency settings: ${error.message}`);
}
