import { CLIENT_ERROR_LISTENER_SOURCE, isClientErrorLoggingActive } from '@/lib/diagnostics/client-error';

// TEMPORARY — see lib/diagnostics/client-error.ts. Adds only an inline error
// listener (no wrapper element, no visual change) while logging is active.
export default function QuotationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {isClientErrorLoggingActive() && <script dangerouslySetInnerHTML={{ __html: CLIENT_ERROR_LISTENER_SOURCE }} />}
      {children}
    </>
  );
}
