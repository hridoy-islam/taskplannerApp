import axiosInstance from './axios';

/** Same shapes as the web CompanyNotesPage. */
export type NoteTag = { _id: string; name: string; author?: string };

export type Note = {
  _id: string;
  title: string;
  /** HTML from the web editor (react-quill). */
  content: string;
  tags: NoteTag[];
  favorite: boolean;
  isArchive: boolean;
  /** User ids. */
  sharedWith: string[];
  author: string | { _id: string; name: string; email?: string };
  createdAt: string;
  updatedAt: string;
};

export type NotesTab = 'my-notes' | 'shared-notes';

export const noteAuthorId = (note: Note) => (typeof note.author === 'string' ? note.author : note.author?._id);
export const noteAuthorName = (note: Note) => (typeof note.author === 'string' ? undefined : note.author?.name);

const list = (res: any) => {
  const data = res.data?.data?.result ?? res.data?.data;
  return Array.isArray(data) ? data : [];
};

// The API paginates at 10 by default; ask for everything so no notes go missing.
const ALL = { params: { limit: 'all' } };

/** My notes + notes shared with me (merged, de-duplicated) and my tags — same three calls as the web page. */
export async function fetchNotesAndTags(userId: string) {
  const [notesRes, sharedRes, tagsRes] = await Promise.all([
    axiosInstance.get(`/notes/${userId}`, ALL),
    axiosInstance.get(`/notes/sharednote/${userId}`, ALL),
    axiosInstance.get(`/tags/user/${userId}`, ALL),
  ]);
  const map = new Map<string, Note>();
  [...list(notesRes), ...list(sharedRes)].forEach((n: Note) => map.set(n._id, n));
  return { notes: Array.from(map.values()), tags: list(tagsRes) as NoteTag[] };
}

export async function createNote(title: string, author: string): Promise<Partial<Note>> {
  const res = await axiosInstance.post('/notes', { title, content: '', tags: [], author });
  // The created note can come back under a few different shapes; use the first one with an id.
  const candidates = [res.data?.data?.result, res.data?.data, res.data?.result, res.data?.note, res.data];
  for (let c of candidates) {
    if (Array.isArray(c)) c = c[0];
    if (c && typeof c === 'object' && c._id) return c;
  }
  return {};
}

/** PATCH a note. Tags are sent as ids (the API stores references). */
export async function updateNote(noteId: string, data: Partial<Note>) {
  const payload: Record<string, unknown> = { ...data };
  if (data.tags) payload.tags = data.tags.map((t) => t._id);
  await axiosInstance.patch(`/notes/singlenote/${noteId}`, payload);
}

export async function deleteNote(noteId: string) {
  await axiosInstance.delete(`/notes/singlenote/${noteId}`);
}

export async function createTag(name: string, author: string): Promise<Partial<NoteTag>> {
  const res = await axiosInstance.post('/tags', { name, author });
  let data = res.data?.data?.result ?? res.data?.data;
  if (Array.isArray(data)) data = data[0];
  return data ?? {};
}

export async function deleteTag(tagId: string) {
  await axiosInstance.delete(`/tags/${tagId}`);
}

/* ---------------------------------------------------------------------------
 * Content: HTML (web Quill editor / app rich editor). Plain text is only used for previews.
 * ------------------------------------------------------------------------- */

/** Treats empty-looking HTML ("", "<p><br></p>", "<div><br></div>") as equal when checking for changes. */
export function normaliseHtml(html?: string) {
  const s = (html ?? '').trim();
  return /^(<(p|div)>(<br\s*\/?>)?<\/(p|div)>)*$/i.test(s) ? '' : s;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** Quill HTML → readable plain text (paragraphs and list items become lines). */
export function htmlToText(html?: string) {
  if (!html) return '';
  return html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Short preview for list rows. */
export function notePreview(note: Note) {
  return htmlToText(note.content).replace(/\s+/g, ' ').trim();
}
