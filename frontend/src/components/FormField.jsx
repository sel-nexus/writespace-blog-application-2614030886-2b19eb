/** Associate controlled account inputs with visible labels and inline errors. */
import PropTypes from 'prop-types';
import { focusRing } from '../utils/ui';

/**
 * Render a required controlled input and its accessible validation feedback.
 * Args:
 *   props (Object): Stable id, label, value, change callback, and optional error/type/autocomplete.
 * Returns:
 *   JSX.Element: Labeled field with an associated alert when invalid.
 */
export default function FormField({ id, label, value, onChange, error = '', type = 'text', autoComplete = 'off' }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-slate-900 ${focusRing}
          ${error ? 'border-red-500' : 'border-slate-300'}`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}

FormField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  type: PropTypes.string,
  autoComplete: PropTypes.string,
};
