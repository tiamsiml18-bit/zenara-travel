import { Loader2 } from 'lucide-react';

/**
 * Shown automatically by Next.js while any page under the (app) layout is
 * being server-rendered (i.e. while its Supabase queries are in flight).
 * Purely a visual loading indicator — fetches, layout, and page content
 * are completely unchanged; this file only fills the moment where the
 * app previously showed nothing at all during a navigation.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-harbor-600" strokeWidth={1.75} />
    </div>
  );
}
