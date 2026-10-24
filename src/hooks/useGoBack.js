import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Where to land when there's no in-app history (deep link / fresh tab). */
export function parentPath(pathname) {
  const m = pathname.match(/^\/events\/([^/]+)\/(roster|edit)$/);
  if (m) return `/events/${m[1]}`;
  return '/calendar';
}

/**
 * Same as the browser's back button when the user arrived from inside the app;
 * otherwise a sensible parent so back never exits the site or does nothing.
 */
export default function useGoBack() {
  const navigate = useNavigate();
  const { key, pathname } = useLocation();
  const hasHistory = key !== 'default';

  const goBack = useCallback(
    (fallback) => {
      if (hasHistory) navigate(-1);
      else navigate(fallback || parentPath(pathname), { replace: true });
    },
    [hasHistory, navigate, pathname]
  );

  return { goBack, hasHistory };
}
