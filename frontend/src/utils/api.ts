/**
 * Resolve a backend API path to a full URL.
 * In production the app may be served under a sub-path (e.g. /tokcollate/),
 * so we detect and prepend that base. In development the backend runs on
 * localhost:5000.
 */
export const getApiUrl = (path: string): string => {
  if (process.env.NODE_ENV === 'production') {
    try {
      const locPath = window.location.pathname || '/';
      const m = locPath.match(/^\/[^/]+\//); // e.g., "/tokcollate/"
      const base = m ? m[0].replace(/\/$/, '') : '';
      return `${base}${path}` || path;
    } catch {
      return path;
    }
  }
  return `http://localhost:5000${path}`;
};
