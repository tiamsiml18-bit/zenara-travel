import { LogoUploader } from '@/components/admin/logo-uploader';
import { FollowUpScheduleForm } from '@/components/admin/followup-schedule-form';
import { Topbar } from '@/components/layout/topbar';
import { createClient } from '@/lib/supabase/server';
import { getAgencySettings } from '@/lib/services/lookups';
import { getQuotationSettings } from '@/lib/services/followups';
import { requireRole } from '@/lib/auth/session';
import { updateAgencySettingsAction } from './actions';

const inputClass =
  'w-full rounded-md border border-sand-200 px-3 py-2 text-sm text-ink-900 outline-none ring-harbor-400 focus:ring-2';

export default async function AgencySettingsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [settings, quotationSettings] = await Promise.all([getAgencySettings(supabase), getQuotationSettings(supabase)]);
  const action = updateAgencySettingsAction.bind(null, settings.id);

  return (
    <>
      <Topbar title="Agency settings" />
      <main className="flex-1 overflow-y-auto p-6">
        <form action={action} className="max-w-2xl space-y-6">
          <Section title="Agency identity">
            <Field label="Agency name" name="agencyName" defaultValue={settings.agency_name} required />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">Logo</label>
              <LogoUploader agencySettingsId={settings.id} currentLogoUrl={settings.logo_url} />
            </div>
          </Section>

          <Section title="Contact information">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" name="phone" defaultValue={settings.phone ?? ''} />
              <Field label="Email" name="email" defaultValue={settings.email ?? ''} />
              <Field label="Website" name="website" defaultValue={settings.website ?? ''} />
              <Field label="Facebook" name="facebook" defaultValue={settings.facebook ?? ''} />
              <Field label="Instagram" name="instagram" defaultValue={settings.instagram ?? ''} />
              <Field label="WhatsApp" name="whatsapp" defaultValue={settings.whatsapp ?? ''} />
              <Field label="Messenger" name="messenger" defaultValue={settings.messenger ?? ''} />
            </div>
            <Field label="Address" name="address" defaultValue={settings.address ?? ''} />
          </Section>

          <Section title="Quotation defaults">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default currency" name="defaultCurrency" defaultValue={settings.default_currency} />
              <Field label="Quotation number prefix" name="quotationNumberPrefix" defaultValue={settings.quotation_number_prefix} />
            </div>
            <TextAreaField label="Quotation footer" name="quotationFooter" defaultValue={settings.quotation_footer ?? ''} />
            <TextAreaField label="Terms and conditions" name="termsAndConditions" defaultValue={settings.terms_and_conditions ?? ''} />
            <TextAreaField label="Payment instructions" name="paymentInstructions" defaultValue={settings.payment_instructions ?? ''} />
          </Section>

          <Section title="Payment fees">
            <p className="mb-3 text-xs text-ink-500">
              These percentages feed directly into every new quotation's Bank Fee calculation — change them here
              rather than in code.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Credit Card fee (%)"
                name="creditCardFeePct"
                defaultValue={String((settings.credit_card_fee_pct ?? 0.029) * 100)}
              />
              <Field label="PayPal fee (%)" name="paypalFeePct" defaultValue={String((settings.paypal_fee_pct ?? 0.039) * 100)} />
            </div>
          </Section>

          <div className="flex justify-end">
            <button type="submit" className="rounded-md bg-harbor-700 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-600">
              Save settings
            </button>
          </div>
        </form>

        <div className="mt-6 max-w-2xl">
          <Section title="Follow-up automation">
            <FollowUpScheduleForm settingsId={quotationSettings.id} currentDays={quotationSettings.followup_schedule_days ?? [2, 3, 5]} />
          </Section>
        </div>

        <p className="mt-6 max-w-2xl text-xs text-ink-500">
          These values feed directly into the client-facing quotation PDF (agency header, footer, terms, payment
          instructions) — changes apply to PDFs generated after saving, not to already-sent quotations, since each
          version's PDF is generated fresh from the current settings at download time.
        </p>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-sand-200 bg-white p-5">
      <h3 className="mb-4 font-display text-sm font-semibold text-ink-900">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-700">{label}</label>
      <input name={name} defaultValue={defaultValue} required={required} className={inputClass} />
    </div>
  );
}

function TextAreaField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-700">{label}</label>
      <textarea name={name} defaultValue={defaultValue} rows={3} className={inputClass} />
    </div>
  );
}
