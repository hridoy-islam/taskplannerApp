import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAppSelector } from '@/hooks/use-redux';
import {
  createNote,
  createTag,
  deleteNote,
  deleteTag,
  fetchNotesAndTags,
  type Note,
  type NoteTag,
  updateNote,
} from '@/lib/notes';
import { toast, toastError } from '@/lib/toast';

const ONE_MINUTE = 60_000;

type NotesContextValue = {
  notes: Note[];
  tags: NoteTag[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Creates a note and resolves with it (for opening the editor). */
  /** ok = the note was created; note = it, when the server returned its id (so it can be opened). */
  addNote: (title: string) => Promise<{ ok: boolean; note: Note | null }>;
  /** Optimistic PATCH; rolls back to the server state on failure. */
  updateNoteApi: (noteId: string, data: Partial<Note>) => Promise<boolean>;
  removeNote: (noteId: string) => Promise<void>;
  addTag: (name: string) => Promise<void>;
  removeTag: (tag: NoteTag) => Promise<void>;
};

const NotesContext = createContext<NotesContextValue | null>(null);

/**
 * Notes state shared by the list and the editor — the same data flow as the web CompanyNotesPage:
 * my notes + shared notes + my tags, refreshed every minute, optimistic updates with rollback.
 */
export function NotesProvider({ children }: { children: ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  const me: string | undefined = user?._id;
  const userName: string | undefined = user?.name;
  const userEmail: string | undefined = user?.email;

  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    (): Promise<void> =>
      me
        ? fetchNotesAndTags(me)
            .then((data) => {
              setNotes(data.notes);
              setTags(data.tags);
            })
            .catch(() => {})
            .finally(() => setLoading(false))
        : Promise.resolve(),
    [me]
  );

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, ONE_MINUTE);
    return () => clearInterval(id);
  }, [refresh]);

  const updateNoteApi = useCallback(
    async (noteId: string, data: Partial<Note>) => {
      setNotes((prev) => prev.map((n) => (n._id === noteId ? { ...n, ...data } : n)));
      try {
        await updateNote(noteId, data);
        return true;
      } catch (e) {
        toastError(e, 'Failed to update note');
        refresh();
        return false;
      }
    },
    [refresh]
  );

  const addNote = useCallback(
    async (title: string) => {
      if (!me) return { ok: false, note: null };
      try {
        const server = await createNote(title, me);
        if (!server._id) {
          // Created, but the response had no id to open: just reload the list.
          toast.success('Note created');
          refresh();
          return { ok: true, note: null };
        }
        const now = new Date().toISOString();
        const note: Note = {
          _id: server._id,
          title,
          content: '',
          tags: [],
          favorite: false,
          isArchive: false,
          sharedWith: [],
          createdAt: now,
          updatedAt: now,
          ...(server as Partial<Note>),
          // Keep the author populated so it shows under "My Notes" straight away.
          author: { _id: me, name: userName ?? '', email: userEmail },
        };
        setNotes((prev) => [note, ...prev.filter((n) => n._id !== note._id)]);
        toast.success('Note created');
        refresh();
        return { ok: true, note };
      } catch (e) {
        toastError(e, 'Failed to create note');
        return { ok: false, note: null };
      }
    },
    [me, userName, userEmail, refresh]
  );

  const removeNote = useCallback(
    async (noteId: string) => {
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
      try {
        await deleteNote(noteId);
        toast.success('Note deleted');
      } catch (e) {
        toastError(e, 'Failed to delete note');
        refresh();
      }
    },
    [refresh]
  );

  const addTag = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!me || !trimmed) return;
      const tempId = `opt-tag-${Date.now()}`;
      setTags((prev) => [{ _id: tempId, name: trimmed, author: me }, ...prev]);
      try {
        const server = await createTag(trimmed, me);
        setTags((prev) => prev.map((t) => (t._id === tempId ? { _id: tempId, name: trimmed, author: me, ...server } : t)));
        toast.success('Tag created');
        refresh();
      } catch (e) {
        setTags((prev) => prev.filter((t) => t._id !== tempId));
        toastError(e, 'Failed to create tag');
      }
    },
    [me, refresh]
  );

  const removeTag = useCallback(
    async (tag: NoteTag) => {
      setTags((prev) => prev.filter((t) => t._id !== tag._id));
      try {
        await deleteTag(tag._id);
        toast.success('Tag deleted');
      } catch (e) {
        toastError(e, 'Failed to delete tag');
        refresh();
      }
    },
    [refresh]
  );

  const value = useMemo(
    () => ({ notes, tags, loading, refresh, addNote, updateNoteApi, removeNote, addTag, removeTag }),
    [notes, tags, loading, refresh, addNote, updateNoteApi, removeNote, addTag, removeTag]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used inside NotesProvider');
  return ctx;
}
