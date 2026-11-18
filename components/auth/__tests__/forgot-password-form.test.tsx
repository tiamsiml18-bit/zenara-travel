import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as any).React = React;
vi.mock('@/app/(auth)/forgot-password/actions', () => ({ requestPasswordResetAction: vi.fn() }));

import { ForgotPasswordFormView } from '@/components/auth/forgot-password-form';

const render = (state: any, email = '') =>
  renderToStaticMarkup(<ForgotPasswordFormView state={state} email={email} onEmailChange={() => {}} onSubmit={() => {}} />);

describe('ForgotPasswordFormView', () => {
  it('idle: shows an enabled "Send reset link" button and no message', () => {
    const html = render({ status: 'idle' });
    expect(html).toContain('Send reset link');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it('submitting: shows a loading label and disables the button and field', () => {
    const html = render({ status: 'submitting' }, 'owner@example.com');
    expect(html).toContain('Sending…');
    expect(html.match(/disabled=""/g)).toHaveLength(2); // the button and the email field
  });

  it('success: shows the confirmation message', () => {
    const html = render({ status: 'success', message: 'A link is on its way.' });
    expect(html).toContain('role="status"');
    expect(html).toContain('A link is on its way.');
  });

  it('error: shows the error message', () => {
    const html = render({ status: 'error', message: 'Please wait.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Please wait.');
  });
});
