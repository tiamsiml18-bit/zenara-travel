'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Trash2 } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { uploadLogoAction, removeLogoAction } from '@/app/(app)/admin/settings/actions';

export function LogoUploader({ agencySettingsId, currentLogoUrl }: { agencySettingsId: string; currentLogoUrl: string | null }) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirmDialog();
  const router = useRouter();

  function handleFileSelected(file: File | undefined) {
    if (!file) return;
    setError(null);
    const localPreviewUrl = URL.createObjectURL(file);
    setPreview(localPreviewUrl);

    const formData = new FormData();
    formData.set('logo', file);
    startTransition(async () => {
      const result = await uploadLogoAction(agencySettingsId, formData);
      if (!result.ok) {
        setError(result.error);
        setPreview(currentLogoUrl);
        return;
      }
      setPreview(result.logoUrl);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-md border border-sand-200 bg-surface">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-only settings preview, not worth next/image remote-domain config
            <img src={preview} alt="Agency logo preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-ink-500">No logo</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-sand-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-sand-100 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> {currentLogoUrl ? 'Replace' : 'Upload'}
            </button>
            {currentLogoUrl && (
              <button
                type="button"
                disabled={isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Remove the agency logo?',
                    description: 'Quotation PDFs will go back to showing text-only branding until a new logo is uploaded.',
                    confirmLabel: 'Remove',
                    tone: 'danger',
                  });
                  if (!ok) return;
                  startTransition(async () => {
                    const result = await removeLogoAction(agencySettingsId);
                    if (result.ok) {
                      setPreview(null);
                      router.refresh();
                    } else {
                      setError(result.error);
                    }
                  });
                }}
                className="flex items-center gap-1.5 rounded-md border border-sand-200 px-3 py-1.5 text-sm font-medium text-coral-600 hover:bg-coral-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-ink-500">JPEG or PNG, up to 5MB. Used on the quotation PDF header and watermark.</p>
          {isPending && <p className="text-xs text-harbor-600">Uploading…</p>}
          {error && <p className="text-xs text-coral-600">{error}</p>}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />
      {dialog}
    </div>
  );
}
