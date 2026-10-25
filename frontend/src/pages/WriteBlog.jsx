/** Render the focused plain-text writing form without saving drafts during render. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { PencilSimple } from '@phosphor-icons/react';
import FormField from '../components/FormField';
import { getSession } from '../utils/auth';
import { getPosts } from '../utils/storage';
import { canEditPost, createPost, editPost } from '../utils/posts';
import { buttonStyles, focusRing, headingFont, isPost } from '../utils/ui';

/**
 * Render create or edit fields with associated errors and a live character count.
 * Args:
 *   props (Object): Local session supplied by the protected route shell.
 * Returns:
 *   JSX.Element: Form, unauthorized redirect, or missing-post back link.
 * Notes:
 *   Only submission saves. Cancel discards component-local values.
 */
export default function WriteBlog({ session = null }) {
  const { id } = useParams();
  const editing = id !== undefined;
  const [post, setPost] = useState(() => editing
    ? getPosts().find(row => isPost(row) && row.id === id) : null);
  const [values, setValues] = useState({ title: post?.title ?? '', content: post?.content ?? '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const current = id === undefined ? null : getPosts().find(row => isPost(row) && row.id === id);
    setPost(current);
    setValues({ title: current?.title ?? '', content: current?.content ?? '' });
    setFields({});
    setError('');
  }, [id]);

  /**
   * Submit current text using a fresh identity and the service's fresh post read.
   * Args:
   *   event (Object): Native form event whose navigation is prevented.
   * Returns:
   *   void: Navigate after persistence, or retain text with inline feedback.
   */
  function submit(event) {
    event.preventDefault();
    const currentSession = getSession();
    const result = editing ? editPost(id, values, currentSession) : createPost(values, currentSession);
    setFields({});
    setError('');
    if (result.ok) {
      navigate(result.navigateTo);
    } else if (result.fields) {
      setFields(result.fields);
    } else {
      setError(result.error.message);
    }
  }

  /**
   * Replace only the edited controlled field without persisting a draft.
   * Args:
   *   event (Object): Input or textarea change event.
   * Returns:
   *   void: Update local form state and its derived count.
   */
  function change(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }

  if (editing && post && !canEditPost(post, session)) return <Navigate to="/blogs" replace />;
  if (editing && !post) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className={`text-4xl text-slate-900 ${headingFont}`}>Post not found</h1>
        <Link to="/blogs" className={`mt-6 ${buttonStyles.ghost}`}>Back to All Blogs</Link>
      </main>
    );
  }
  const cancelHref = editing ? `/blog/${encodeURIComponent(id)}` : '/blogs';
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <h1 className={`text-4xl text-slate-900 ${headingFont}`}>{editing ? 'Edit Blog' : 'Write a Blog'}</h1>
      <p className="mt-3 text-slate-600">Give your ideas room to grow. Your post is saved only when you submit.</p>
      <form noValidate onSubmit={submit} className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <FormField id="title" label="Title" value={values.title} onChange={change} error={fields.title} />
        <div className="space-y-2">
          <label htmlFor="content" className="block text-sm font-medium text-slate-800">Content</label>
          <textarea
            id="content"
            name="content"
            value={values.content}
            onChange={change}
            required
            aria-required="true"
            aria-invalid={Boolean(fields.content)}
            aria-describedby={fields.content ? 'content-error content-count' : 'content-count'}
            className={`min-h-64 w-full rounded-lg border bg-white px-3 py-2 leading-relaxed text-slate-900 ${focusRing}
              ${fields.content ? 'border-red-500' : 'border-slate-300'}`}
          />
          {fields.content && <p id="content-error" role="alert" className="text-sm text-red-700">{fields.content}</p>}
          <p id="content-count" role="status" className="text-right text-sm tabular-nums text-slate-600">
            {values.content.length} characters
          </p>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-col gap-3 md:flex-row">
          <button type="submit" className={buttonStyles.primary}>
            <PencilSimple size={20} aria-hidden="true" /> {editing ? 'Save Changes' : 'Publish Blog'}
          </button>
          <Link to={cancelHref} className={buttonStyles.ghost}>Cancel</Link>
        </div>
      </form>
    </main>
  );
}

WriteBlog.propTypes = { session: PropTypes.object };
