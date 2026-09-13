import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

/**
 * Shared Button — consolidates the ~11 slightly-different inline button
 * class strings found across the app during the Phase 1 audit (varying
 * padding, varying disabled opacity, one that even broke the color
 * system with `text-white` instead of `text-sand-50`) into one place.
 *
 * Every class below is lifted directly from the most common existing
 * pattern for that role — nothing new was invented. No existing page is
 * migrated onto this yet (that's a later phase); this just makes the
 * correct, consistent version available.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'icon';
export type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // The dominant existing pattern for primary actions (e.g. the
  // Acknowledge button, Save actions) — bg-harbor-700, text-sand-50,
  // hover:bg-harbor-600. The one outlier that used text-white/harbor-800
  // is treated as the error it is, not a second valid variant.
  primary: 'bg-harbor-700 text-sand-50 hover:bg-harbor-600',
  // Existing muted/secondary pattern (e.g. non-destructive secondary
  // actions) — sand background, ink text.
  secondary: 'bg-sand-100 text-ink-700 hover:bg-sand-200',
  // Existing "Cancel" pattern from confirm-dialog.tsx and the
  // Quotations/Bookings delete confirmations — bordered, no fill.
  outline: 'border border-sand-200 text-ink-700 hover:bg-sand-100',
  // Existing destructive pattern (Delete Selected, confirm-delete) —
  // coral-600, matching the app's one sparing danger color.
  destructive: 'bg-coral-600 text-sand-50 hover:bg-coral-700',
  // Existing icon-button pattern from the sidebar/profile menu toggles —
  // no fill, ink-500 default, hover to a light sand chip.
  icon: 'text-ink-500 hover:bg-sand-100 hover:text-ink-900',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-1.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref
) {
  if (variant === 'icon') {
    // Icon buttons are a fixed square (matches the existing h-8 w-8
    // sidebar/profile-menu toggle pattern exactly), not part of the
    // sm/md text-button sizing scale.
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          VARIANT_CLASSES.icon,
          className
        )}
        {...props}
      />
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
});
