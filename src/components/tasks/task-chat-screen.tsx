import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  type ListRenderItem,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Socket } from 'socket.io-client';

import { getInitials } from '@/components/ui/avatar';
import { DotLoader } from '@/components/ui/dot-loader';
import { useAppSelector } from '@/hooks/use-redux';
import axiosInstance from '@/lib/axios';
import { formatDisplayDate, formatTime, isSameUkDay } from '@/lib/date';
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
  uploadTaskFile,
} from '@/lib/tasks';
import { toast, toastError } from '@/lib/toast';

const TYPING_TIMEOUT_MS = 3000;

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
  const [uploading, setUploading] = useState(false);
  const [connected, setConnected] = useState(false);
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

  const onAttach = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Photo access needed', 'Allow photo access to send pictures.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const type = asset.mimeType ?? 'image/jpeg';
    const name = asset.fileName ?? `photo.${type.split('/')[1] ?? 'jpg'}`;

    setUploading(true);
    try {
      let file: any = { uri: asset.uri, name, type };
      if (Platform.OS === 'web') {
        const blob = await (await fetch(asset.uri)).blob();
        file = new File([blob], name, { type });
      }
      const url = await uploadTaskFile(taskId, file);
      if (!url) throw new Error('Upload failed');
      await send(url, true);
      toast.success('File sent');
    } catch (e) {
      toastError(e, 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const startEdit = useCallback((comment: Comment) => {
    setEditing(comment);
    setText(comment.content);
  }, []);

  const cancelEdit = () => {
    setEditing(null);
    setText('');
  };

  // Inverted list: newest at the bottom, kept in view as messages arrive.
  const data = useMemo(() => [...comments].reverse(), [comments]);

  const renderItem = useCallback<ListRenderItem<Comment>>(
    ({ item, index }) => {
      const mine = refId(item.authorId) === me;
      // In the inverted list the "previous" message (older) is at index + 1.
      const older = data[index + 1];
      const showName = !mine && (!older || refId(older.authorId) !== refId(item.authorId));
      return <MessageBubble comment={item} mine={mine} showName={showName} onEdit={startEdit} />;
    },
    [me, data, startEdit]
  );

  const other = refId(task?.author) === me ? task?.assigned : task?.author;
  const otherName = refName(other) ?? 'Chat';

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-100"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
    >
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
          <Text className="text-xs font-medium text-black" numberOfLines={1}>
            {otherTyping ? 'typing…' : task?.taskName ?? ''}
          </Text>
        </View>
        <View
          className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}
          accessibilityLabel={connected ? 'Connected' : 'Connecting'}
        />
      </View>

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
            ) : null
          }
        />
      )}

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
              onPress={onAttach}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Send a picture"
              className="h-11 w-11 items-center justify-center rounded-full bg-slate-100 active:opacity-70"
            >
              {uploading ? (
                <DotLoader size={5} label="Uploading" />
              ) : (
                <SymbolView name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }} size={20} tintColor="#000000" />
              )}
            </Pressable>
          ) : null}
          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder="Type a message…"
            placeholderTextColor="#64748b"
            multiline
            className="max-h-32 min-h-11 flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] text-black"
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
    </KeyboardAvoidingView>
  );
}

const MessageBubble = memo(function MessageBubble({
  comment,
  mine,
  showName,
  onEdit,
}: {
  comment: Comment;
  mine: boolean;
  showName: boolean;
  onEdit: (c: Comment) => void;
}) {
  const file = comment.isFile ? parseFileComment(comment.content) : null;
  const canEdit = mine && !comment.isFile && !comment.pending && !comment._id.startsWith('local-');

  return (
    <View className={`max-w-[80%] gap-0.5 ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
      {showName ? <Text className="ml-1 text-[11px] font-bold text-black">{refName(comment.authorId) ?? 'User'}</Text> : null}
      <Pressable
        onLongPress={canEdit ? () => onEdit(comment) : undefined}
        onPress={file ? () => Linking.openURL(file.url).catch(() => toast.error('Could not open file')) : undefined}
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
      <Text className="mx-1 text-[10px] font-medium text-black">{comment.pending ? 'Sending…' : formatMessageTime(comment.createdAt)}</Text>
    </View>
  );
});
