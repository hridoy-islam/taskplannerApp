const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/** Origin of the API (e.g. http://10.0.2.2:4000), where `/uploads` is served. */
function apiOrigin() {
  const match = API_URL.match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1] : '';
}

/**
 * Turns a stored image value into a loadable URL.
 * Full URLs (e.g. Cloudinary) are returned as-is; relative paths like
 * `uploads/abc.png` are resolved against the API origin.
 */
export function resolveImageUrl(image?: string | null): string | undefined {
  if (!image) return undefined;
  const value = image.trim();
  if (!value) return undefined;
  if (/^(https?:|data:|file:)/i.test(value)) return value;
  return `${apiOrigin()}/${value.replace(/^\/+/, '')}`;
}
