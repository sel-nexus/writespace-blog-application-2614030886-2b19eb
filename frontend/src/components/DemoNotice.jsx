/** Explain browser-local demo limitations before visitors enter credentials. */
import { Info } from '@phosphor-icons/react';

/**
 * Render the truthful data and identity boundary for this local demo.
 * Returns:
 *   JSX.Element: A labeled informational notice without security claims.
 */
export default function DemoNotice() {
  return (
    <aside aria-label="Local demo limitations" className="rounded-xl bg-indigo-50 p-5 text-sm text-slate-700">
      <div className="flex items-start gap-3">
        <Info size={24} className="shrink-0 text-indigo-700" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-semibold text-indigo-900">A browser-local demo.</strong>{' '}
          Posts, accounts and plaintext credentials stay in this browser’s localStorage.
          Client-side roles are editable, not trusted authorization. Do not enter real passwords
          or sensitive data. There is no server, synchronization or backup; clearing browser data
          removes your local records.
        </p>
      </div>
    </aside>
  );
}
