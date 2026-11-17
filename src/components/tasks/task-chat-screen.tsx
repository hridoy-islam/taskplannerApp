import { Image } from 'expo-image';
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type ListRenderItem,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Socket } from 'socket.io-client';

import { AttachMenu, UploadQueue, useChatUploads } from '@/components/chat/chat-uploads';
import { useFileViewer, type ViewableFile } from '@/components/files/file-viewer';
import { AttachmentsSheet } from '@/components/tasks/chat-attachments';
import { getInitials } from '@/components/ui/avatar';
import { DotLoader } from '@/components/ui/dot-loader';
import { KeyboardPaddingView } from '@/components/ui/keyboard-avoiding-view';
import { useAppSelector } from '@/hooks/use-redux';
import axiosInstance from '@/lib/axios';
import { formatDisplayDate, formatTime, isSameUkDay, isSameUkMinute } from '@/lib/date';
import { setActiveChat } from '@/lib/device-notifications';
import { connectSocket } from '@/lib/socket';
import {
  type Comment,
  fetchComments,
  fetchTask,
  markCommentsRead,
  parseFileComment,
  postComment,
  refId,
  refName,
  type TaskDetail,
} from '@/lib/tasks';
import { uploadChatFile } from '@/lib/chat-uploads';
import { toast, toastError } from '@/lib/toast';

const TYPING_TIMEOUT_MS = 3000;
/** Task names longer than this are cut with "…" in the chat header (the web truncates at 30). */
const TITLE_MAX = 30;

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

/** Time for today's messages, otherwise "dd MMM, yyyy · time". */
function formatMessageTime(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = isSameUkDay(d, new Date());
  return sameDay ? formatTime(d) : `${formatDisplayDate(d)} · ${formatTime(d)}`;
}

/** Normalises a socket "message received" payload into a Comment (same handling as the web chat). */
function normaliseIncoming(payload: any): (Comment & { taskName?: string }) | null {
  const data = payload?.data ?? payload;
  if (!data || typeof data !== 'object' || !data.taskId) return null;
  const authorId = typeof data.authorId === 'object' ? data.authorId?._id : data.authorId;
  const authorName = typeof data.authorId === 'object' ? data.authorId?.name : data.authorName;
  return {
    _id: data._id || `remote-${Date.now()}`,
    taskId: data.taskId,
    content: data.content ?? '',
    isFile: !!data.isFile,
    authorId: { _id: authorId, name: authorName },
    createdAt: data.createdAt || new Date().toISOString(),
    taskName: data.taskName,
  };
}

/** Real-time task chat (socket.io), mirroring the web task chat. */
export default function TaskChatScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.auth.user) as { _id: string; name?: string } | null;
  const me = user?._id;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [editing, setEditing] = useState<Comment | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const typingRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = useCallback(
    (messageId?: string) => {
      if (me && messageId && !messageId.startsWith('local-')) markCommentsRead(taskId, me, messageId).catch(() => {});
    },
    [taskId, me]
  );

  // While this chat is on screen, don't alert for it in the phone's tray.
  useFocusEffect(
    useCallback(() => {
      setActiveChat(taskId);
      return () => setActiveChat(null);
    }, [taskId])
  );

  // Initial load: task header + history.
  useEffect(() => {
    let active = true;
    Promise.all([fetchTask(taskId), fetchComments(taskId)])
      .then(([t, list]) => {
        if (!active) return;
        setTask(t);
        setComments(list);
        markRead(list[list.length - 1]?._id);
      })
      .catch((e) => toastError(e, 'Failed to load chat'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [taskId, markRead]);

  // Socket: setup → join this task's room; listen for messages and typing.
  useEffect(() => {
    if (!user?._id) return;
    const socket = connectSocket(user);
    socketRef.current = socket;

    const join = () => socket.emit('join chat', taskId);
    socket.on('connected', () => {
      setConnected(true);
      join();
    });
    socket.on('connect', join);
    socket.on('disconnect', () => setConnected(false));

    socket.on('message received', (payload: unknown) => {
      const incoming = normaliseIncoming(payload);
      if (!incoming) return;
      if (incoming.taskId !== taskId) {
        // A message for another task: notify like the web app does.
        toast.info(`Task: ${incoming.taskName || 'New message'}`, incoming.isFile ? 'Sent a file' : incoming.content);
        return;
      }
      if (refId(incoming.authorId) === user._id) return; // our own echo
      setComments((prev) => (prev.some((c) => c._id === incoming._id) ? prev : [...prev, incoming]));
      setOtherTyping(false);
      markRead(incoming._id);
    });

    socket.on('typing', () => setOtherTyping(true));
    socket.on('stop typing', () => setOtherTyping(false));

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      socket.emit('stop typing', taskId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, taskId, markRead]);

  const stopTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingRef.current) {
      typingRef.current = false;
      socketRef.current?.emit('stop typing', taskId);
    }
  }, [taskId]);

  const onChangeText = (value: string) => {
    setText(value);
    if (editing || !connected) return;
    if (!typingRef.current) {
      typingRef.current = true;
      socketRef.current?.emit('typing', taskId);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, TYPING_TIMEOUT_MS);
  };

  const taskName = task?.taskName;
  const userName = user?.name;

  /** Posts a message, shows it immediately, then broadcasts it over the socket. */
  const send = useCallback(
    async (content: string, isFile = false) => {
      if (!me || !content.trim()) return;
      const localId = `local-${Date.now()}`;
      const optimistic: Comment = {
        _id: localId,
        taskId,
        content,
        isFile,
        authorId: { _id: me, name: userName },
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setComments((prev) => [...prev, optimistic]);
      try {
        const saved = await postComment({ taskId, authorId: me, content, isFile });
        const final: Comment = {
          ...optimistic,
          _id: saved?._id ?? localId,
          createdAt: saved?.createdAt ?? optimistic.createdAt,
          pending: false,
        };
        setComments((prev) => prev.map((c) => (c._id === localId ? final : c)));
        markRead(final._id);
        socketRef.current?.emit('new message', { data: { ...final, taskName } });
      } catch (e) {
        setComments((prev) => prev.filter((c) => c._id !== localId));
        toastError(e, 'Message not sent');
        throw e;
      }
    },
    [me, taskId, userName, taskName, markRead]
  );

  const onSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    stopTyping();

    if (editing) {
      setSending(true);
      try {
        await axiosInstance.patch(`/comment/${editing._id}`, { content: value });
        setComments((prev) => prev.map((c) => (c._id === editing._id ? { ...c, content: value } : c)));
        toast.success('Message updated');
        setEditing(null);
        setText('');
      } catch (e) {
        toastError(e, 'Failed to update message');
      } finally {
        setSending(false);
      }
      return;
    }

    setText('');
    setSending(true);
    try {
      await send(value);
    } catch {
      setText(value); // give it back so it can be retried
    } finally {
      setSending(false);
    }
  };

  const uploads = useChatUploads({
    upload: (file, options) => uploadChatFile(taskId, 'taskDoc', file, options),
    send: (url) => send(url, true),
  });

  const startEdit = useCallback((comment: Comment) => {
    setEditing(comment);
    setText(comment.content);
  }, []);

  const cancelEdit = () => {
    setEditing(null);
    setText('');
  };

  const { openFile, viewer: fileViewer } = useFileViewer();

  // Inverted list: newest at the bottom, kept in view as messages arrive.
  const data = useMemo(() => [...comments].reverse(), [comments]);

  const renderItem = useCallback<ListRenderItem<Comment>>(
    ({ item, index }) => {
      const mine = refId(item.authorId) === me;
      // In the inverted list the "previous" message (older) is at index + 1.
      const older = data[index + 1];
      const showName = !mine && (!older || refId(older.authorId) !== refId(item.authorId));
      // One time under a run of messages from the same person in the same minute (on the last one).
      const newer = data[index - 1];
      const showTime =
        !!item.pending ||
        !newer ||
        !!newer.pending ||
        refId(newer.authorId) !== refId(item.authorId) ||
        !isSameUkMinute(newer.createdAt, item.createdAt);
      return (
        <MessageBubble comment={item} mine={mine} showName={showName} showTime={showTime} onEdit={startEdit} onOpenFile={openFile} />
      );
    },
    [me, data, startEdit, openFile]
  );

  // Files shared in this chat, newest first (for the ⋮ → Attachments sheet).
  const files = useMemo(() => comments.filter((c) => c.isFile && !c.pending).reverse(), [comments]);
  const taskTitle = truncate(task?.taskName ?? '', TITLE_MAX);

  const other = refId(task?.author) === me ? task?.assigned : task?.author;
  const otherName = refName(other) ?? 'Chat';

  return (
    // The composer already pads for the navigation bar; leave an 8px gap above the keyboard.
    <KeyboardPaddingView className="flex-1 bg-slate-100" bottomInset={Math.max(insets.bottom, 8) - 8}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/home' as Href))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 active:opacity-70"
        >
          <SymbolView name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor="#000000" />
        </Pressable>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
          <Text className="text-xs font-bold text-white">{getInitials(otherName)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-black" numberOfLines={1}>
            {otherName}
          </Text>
          <Text className="text-xs font-medium text-black" numberOfLines={1} ellipsizeMode="tail">
            {otherTyping ? 'typing…' : taskTitle}
          </Text>
        </View>
        <Pressable
          onPress={() => setAttachmentsOpen(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Media and docs"
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"
        >
          <SymbolView name={{ ios: 'photo.on.rectangle.angled', android: 'perm_media', web: 'perm_media' }} size={19} tintColor="#000000" />
        </Pressable>
      </View>

      <AttachmentsSheet
        visible={attachmentsOpen}
        files={files}
        subtitle={taskTitle}
        onClose={() => setAttachmentsOpen(false)}
      />
      {fileViewer}
      <AttachMenu visible={attachOpen} onClose={() => setAttachOpen(false)} onPicked={uploads.add} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <DotLoader label="Loading messages" />
        </View>
      ) : comments.length === 0 ? (
        // Rendered outside the inverted list so it isn't flipped upside down.
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <SymbolView
            name={{ ios: 'bubble.left.and.bubble.right', android: 'forum', web: 'forum' }}
            size={40}
            tintColor="#00214c"
          />
          <Text className="text-center text-base font-bold text-black">No messages yet</Text>
          <Text className="text-center text-sm text-black">Start the conversation about this task.</Text>
          {otherTyping ? (
            <View className="mt-2 rounded-2xl bg-white px-3 py-2.5">
              <DotLoader size={6} label={`${otherName} is typing`} />
            </View>
          ) : null}
        </View>
      ) : (
        <FlatList
          inverted
          data={data}
          keyExtractor={(c) => c._id}
          renderItem={renderItem}
          contentContainerClassName="gap-1.5 px-3 py-4"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          windowSize={11}
          ListHeaderComponent={
            otherTyping ? (
              <View className="mt-1 self-start rounded-2xl rounded-bl-md bg-white px-3 py-2.5">
                <DotLoader size={6} label={`${otherName} is typing`} />
              </View>
            ) : undefined
          }
        />
      )}

      <UploadQueue items={uploads.items} onCancel={uploads.cancel} onRetry={uploads.retry} />

      {/* Composer */}
      <View className="border-t border-slate-200 bg-white px-3 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        {editing ? (
          <View className="mb-2 flex-row items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
            <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={14} tintColor="#b45309" />
            <Text className="flex-1 text-xs font-semibold text-black" numberOfLines={1}>
              Editing message
            </Text>
            <Pressable onPress={cancelEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel editing">
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor="#000000" />
            </Pressable>
          </View>
        ) : null}
        <View className="flex-row items-end gap-2">
          {!editing ? (
            <Pressable
              onPress={() => setAttachOpen(true)}
                            accessibilityRole="button"
              accessibilityLabel="Attach files"
              className="h-11 w-11 items-center justify-center rounded-full bg-slate-100 active:opacity-70"
            >
              <SymbolView name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }} size={20} tintColor="#000000" />
            </Pressable>
          ) : null}
          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder="Type a message…"
            placeholderTextColor="#64748b"
            multiline
            className="max-h-32 min-h-11 flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 text-[15px] text-black"
            // One line fits inside min-h-11 (44px), the same height as the round buttons on either side.
            style={{ paddingTop: 11, paddingBottom: 11, includeFontPadding: false }}
            textAlignVertical="center"
            maxFontSizeMultiplier={1.2}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={onSend}
            disabled={!text.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Save message' : 'Send message'}
            className={`h-11 w-11 items-center justify-center rounded-full ${text.trim() ? 'bg-primary' : 'bg-slate-300'}`}
          >
            <SymbolView
              name={editing ? { ios: 'checkmark', android: 'check', web: 'check' } : { ios: 'paperplane.fill', android: 'send', web: 'send' }}
              size={18}
              tintColor="#ffffff"
            />
          </Pressable>
        </View>
      </View>
    </KeyboardPaddingView>
  );
}

const MessageBubble = memo(function MessageBubble({
  comment,
  mine,
  showName,
  showTime,
  onEdit,
  onOpenFile,
}: {
  comment: Comment;
  mine: boolean;
  showName: boolean;
  showTime: boolean;
  onEdit: (c: Comment) => void;
  onOpenFile: (f: ViewableFile) => void;
}) {
  const file = comment.isFile ? parseFileComment(comment.content) : null;
  const canEdit = mine && !comment.isFile && !comment.pending && !comment._id.startsWith('local-');

  return (
    <View className={`max-w-[80%] gap-0.5 ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
      {showName ? <Text className="ml-1 text-[11px] font-bold text-black">{refName(comment.authorId) ?? 'User'}</Text> : null}
      <Pressable
        onLongPress={canEdit ? () => onEdit(comment) : undefined}
        onPress={file ? () => onOpenFile(file) : undefined}
        delayLongPress={300}
        accessibilityHint={canEdit ? 'Long press to edit' : file ? 'Opens the file' : undefined}
        className={`overflow-hidden rounded-2xl ${
          mine ? 'rounded-br-md bg-primary' : 'rounded-bl-md border border-slate-200 bg-white'
        } ${file?.isImage ? 'p-1' : 'px-3.5 py-2.5'} ${comment.pending ? 'opacity-60' : ''}`}
      >
        {file?.isImage ? (
          <Image source={{ uri: file.url }} style={{ width: 220, height: 220, borderRadius: 14 }} contentFit="cover" />
        ) : file ? (
          <View className="flex-row items-center gap-2">
            <SymbolView name={{ ios: 'doc.fill', android: 'description', web: 'description' }} size={18} tintColor={mine ? '#ffffff' : '#00214c'} />
            <Text className={`flex-shrink text-sm font-semibold underline ${mine ? 'text-white' : 'text-black'}`} numberOfLines={1}>
              {file.name}
            </Text>
          </View>
        ) : (
          <Text className={`text-[15px] leading-[21px] ${mine ? 'text-white' : 'text-black'}`}>{comment.content}</Text>
        )}
      </Pressable>
      {showTime ? (
        <Text className="mx-1 text-[10px] font-medium text-black">{comment.pending ? 'Sending…' : formatMessageTime(comment.createdAt)}</Text>
      ) : null}
    </View>
  );
});
