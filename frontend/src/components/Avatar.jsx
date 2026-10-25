/** Render consistent SVG role cues without implying trusted authorization. */
import PropTypes from 'prop-types';
import { BookOpen, Crown } from '@phosphor-icons/react';

const roles = {
  admin: { Icon: Crown, style: 'bg-violet-600', label: 'Admin avatar' },
  user: { Icon: BookOpen, style: 'bg-indigo-500', label: 'User avatar' },
};

/**
 * Render a circular role glyph.
 * Args:
 *   props (Object): Optional admin or user role; unknown roles use the user cue.
 * Returns:
 *   JSX.Element: Accessible role avatar with a decorative SVG glyph.
 */
export default function Avatar({ role = 'user' }) {
  const { Icon, style, label } = roles[role] || roles.user;
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${style}`}
    >
      <Icon size={24} weight="regular" aria-hidden="true" />
    </span>
  );
}

Avatar.propTypes = { role: PropTypes.oneOf(['admin', 'user']) };

/**
 * Return the JSX avatar required by shared publication components.
 * Args:
 *   role (string): Demo role whose visual cue is requested.
 * Returns:
 *   JSX.Element: A role avatar component.
 */
export function getAvatar(role) {
  return <Avatar role={role} />;
}
