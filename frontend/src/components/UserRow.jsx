/** Render equivalent desktop and mobile account details without accepting credentials. */
import PropTypes from 'prop-types';
import { Trash } from '@phosphor-icons/react';
import Avatar from './Avatar';
import { buttonStyles, formatDate } from '../utils/ui';

/**
 * Render one safe account in a table row or stacked card.
 * Args:
 *   props (Object): Public account fields, layout, protection explanation and delete callback.
 * Returns:
 *   JSX.Element: Equivalent avatar, name, username, role, date and deletion control.
 */
export function UserRow({ account, mobile = false, disabledReason = '', onDelete }) {
  const role = account.role === 'admin' ? 'Admin' : 'User';
  const action = (
    <span title={disabledReason || undefined} className="inline-block">
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason || undefined}
        aria-label={`Delete ${account.username}`}
        aria-describedby={disabledReason ? `${mobile ? 'card' : 'row'}-${account.id}-reason` : undefined}
        onClick={() => onDelete(account.id)}
        className={`${buttonStyles.destructive} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <Trash size={20} aria-hidden="true" />
        Delete
      </button>
      {disabledReason && (
        <span id={`${mobile ? 'card' : 'row'}-${account.id}-reason`} className="block max-w-48 text-xs text-slate-600">
          {disabledReason}
        </span>
      )}
    </span>
  );
  if (mobile) {
    return (
      <li className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <Avatar role={account.role} />
          <h3 className="break-all font-semibold">{account.displayName}</h3>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Username</dt>
          <dd className="break-all">{account.username}</dd>
          <dt>Role</dt>
          <dd>{role}</dd>
          <dt>Created</dt>
          <dd>{formatDate(account.createdAt)}</dd>
        </dl>
        {action}
      </li>
    );
  }
  return (
    <tr className="border-t border-slate-100">
      <td className="p-4">
        <Avatar role={account.role} />
      </td>
      <th scope="row" className="break-all p-4 text-left font-semibold">{account.displayName}</th>
      <td className="break-all p-4">{account.username}</td>
      <td className="p-4">{role}</td>
      <td className="p-4 tabular-nums">{formatDate(account.createdAt)}</td>
      <td className="p-4">{action}</td>
    </tr>
  );
}

UserRow.propTypes = {
  account: PropTypes.exact({
    id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  mobile: PropTypes.bool,
  disabledReason: PropTypes.string,
  onDelete: PropTypes.func.isRequired,
};

export default UserRow;
