/** Decode a current-workspace folder target without granting filesystem access. */
export function workspaceFolderPath(reference: string): string | undefined {
  if (!reference.startsWith('workspace-folder:')) return undefined;
  const encoded = reference.slice('workspace-folder:'.length);
  if (/[?#]/u.test(encoded)) return undefined;
  let path: string;
  try {
    path = decodeURIComponent(encoded).replace(/\\/gu, '/');
  } catch {
    return undefined;
  }
  if (
    !path.trim() ||
    path.startsWith('/') ||
    path.includes(':') ||
    Array.from(path).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    path.split('/').includes('..')
  )
    return undefined;
  return path.replace(/^\.\//u, '').replace(/\/$/u, '') || '.';
}
