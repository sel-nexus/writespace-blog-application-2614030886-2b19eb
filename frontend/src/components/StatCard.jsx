/** Present a named dashboard metric without calculating its meaning. */
import { isValidElement } from 'react';
import PropTypes from 'prop-types';
import { ChartBar } from '@phosphor-icons/react';

/**
 * Render a readable label, value, and decorative Phosphor icon.
 * Args:
 *   props (Object): Display value, label, and optional icon element.
 * Returns:
 *   JSX.Element: A metric with safe fallbacks for absent or unusable input.
 */
export function StatCard({ value = '—', label = 'Statistic', icon = null }) {
  const safeLabel = typeof label === 'string' && label.trim() ? label : 'Statistic';
  const safeValue = (typeof value === 'number' && Number.isFinite(value))
    || (typeof value === 'string' && value.trim()) ? value : '—';
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-5 inline-flex rounded-lg bg-indigo-50 p-3 text-indigo-700" aria-hidden="true">
        {isValidElement(icon) ? icon : <ChartBar size={24} />}
      </div>
      <dl>
        <dt className="break-words text-sm font-medium text-slate-600">{safeLabel}</dt>
        <dd className="mt-2 break-words text-3xl font-semibold tabular-nums text-slate-900">{safeValue}</dd>
      </dl>
    </div>
  );
}

StatCard.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  label: PropTypes.string,
  icon: PropTypes.element,
};

export default StatCard;
