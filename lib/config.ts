/**
 * Base URL for all API requests.
 *
 * In production (Vercel), set NEXT_PUBLIC_API_URL to your Render backend URL:
 *   e.g. https://your-backend.onrender.com/api
 *
 * In local development, leave NEXT_PUBLIC_API_URL unset and the default
 * points to the Express server running on port 3001.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
