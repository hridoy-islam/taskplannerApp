import { Image } from 'expo-image';
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  type ListRenderItem,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Socket } from 'socket.io-client';

import { AttachMenu, UploadQueue, useChatUploads } from '@/components/chat/chat-uploads';
import { useFileViewer, type ViewableFile } from '@/components/files/file-viewer';
import { useGroupManagement } from '@/components/groups/group-manage';
import { AttachmentsSheet } from '@/components/tasks/chat-attachments';
import { Avatar } from '@/components/ui/avatar';
import { DotLoader } from '@/components/ui/dot-loader';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { useAppSelector } from '@/hooks/use-redux';
import { formatDisplayDate, formatTime, isSameUkDay } from '@/lib/date';
import {
  editGroupMessage,
  fetchGroup,
  fetchGroupMessages,
  findMentions,
  type GroupDetail,
  type GroupMember,
  type GroupMessage,
  markGroupRead,
  messageAuthorId,
  normaliseIncomingGroupMessage,
  postGroupMessage,
} from '@/lib/groups';
import { resolveImageUrl } from '@/lib/image-url';
import { connectSocket } from '@/lib/socket';
import { type Comment, parseFileComment } from '@/lib/tasks';
import { uploadChatFile } from '@/lib/chat-uploads';
import { toast, toastError } from '@/lib/toast';

const TYPING_TIMEOUT_MS = 3000;

const ICONS = {
  back: { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  media: { ios: 'photo.on.rectangle.angled', android: 'perm_media', web: 'perm_media' },
  attach: { ios: 'paperclip', android: 'attach_file', web: 'attach_file' },
  send: { ios: 'paperplane.fill', android: 'send', web: 'send' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  reply: { ios: 'arrowshape.turn.up.left', android: 'reply', web: 'reply' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  file: { ios: 'doc.fill', android: 'description', web: 'description' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  groups: { ios: 'person.3', android: 'groups', web: 'groups' },
} as const;

const nameOf = (m?: GroupMessage | null) => (m && typeof m.authorId === 'object' ? m.authorId?.name : undefined);

function formatMessageTime(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return isSameUkDay(d, new Date()) ? formatTime(d) : `${formatDisplayDate(d)} · ${formatTime(d)}`;
}

/**
 * Group chat (web CompanyGroupChat) over the same socket events:
 * setup → join chat / leave chat, typing / stop typing, new message → message received.
 * Replies, editing your own messages, @mentions, pictures, older messages on scroll, read receipts.
 * Non-admins can't send when the group isn't active ("admin only").
 */
export default function GroupChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const me: string | undefined = user?._id;
  const myName: string | undefined = user?.name;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const [editing, setEditing] = useState<GroupMessage | null>(null);
  const [actionFor, setActionFor] = useState<GroupMessage | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theirTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------- data ---------------- */

  const loadGroup = useCallback(
    () =>
      groupId
        ? fetchGroup(groupId)
            .then((g) => {
              setGroup(g);
              setError(null);
            })
            .catch((e) => setError(e?.response?.data?.message ?? 'Could not load this group'))
        : Promise.resolve(),
    [groupId]
  );

  const markRead = useCallback(
    (messageId?: string) => {
      if (groupId && me && messageId && !messageId.startsWith('local-') && !messageId.startsWith('remote-')) {
        markGroupRead(groupId, me, messageId).catch(() => {});
      }
    },
    [groupId, me]
  );

  // First load: group + newest page of messages.
  useEffect(() => {
    if (!groupId) return;
    Promise.all([
      loadGroup(),
      fetchGroupMessages(groupId, 1)
        .then((list) => {
          setMessages(list);
          markRead(list[list.length - 1]?._id);
        })
        .catch((e) => toastError(e, 'Could not load messages')),
    ]).finally(() => setLoading(false));
  }, [groupId, loadGroup, markRead]);

  // Settings/members may change on the info page.
  const returning = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (returning.current) loadGroup();
      returning.current = true;
    }, [loadGroup])
  );

  const appendMessage = useCallback(
    (m: GroupMessage) => {
      setMessages((prev) => (prev.some((p) => p._id === m._id) ? prev : [...prev, m]));
      markRead(m._id);
    },
    [markRead]
  );

  /* ---------------- socket ---------------- */

  useEffect(() => {
    if (!me || !groupId) return;
    const socket = connectSocket({ _id: me, name: myName });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('join chat', groupId));
    socket.on('connected', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.emit('join chat', groupId);

    socket.on('typing', (typer: any) => {
      if (typer?.room !== groupId || typer?.user === me) return;
      setTypingUser(typer.user);
      if (theirTypingTimer.current) clearTimeout(theirTypingTimer.current);
      theirTypingTimer.current = setTimeout(() => setTypingUser(null), TYPING_TIMEOUT_MS + 1000);
    });
    socket.on('stop typing', (typer: any) => {
      if (typer?.room === groupId && typer?.user !== me) setTypingUser(null);
    });

    socket.on('message received', (payload: any) => {
      const incoming = normaliseIncomingGroupMessage(payload);
      if (!incoming || messageAuthorId(incoming) === me) return;
      if (incoming.taskId === groupId) {
        setTypingUser(null);
        appendMessage(incoming);
      } else {
        toast.info(`Group: ${incoming.taskName || 'New message'}`, incoming.isFile ? 'Sent a file' : incoming.content);
      }
    });

    return () => {
      socket.emit('stop typing', { room: groupId, user: me });
      socket.emit('leave chat', groupId);
      socket.disconnect();
      socketRef.current = null;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (theirTypingTimer.current) clearTimeout(theirTypingTimer.current);
    };
  }, [me, myName, groupId, appendMessage]);

  const stopTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingRef.current) {
      typingRef.current = false;
      socketRef.current?.emit('stop typing', { room: groupId, user: me });
    }
  }, [groupId, me]);

  const onChangeText = (value: string) => {
    setText(value);
    if (!connected || editing) return;
    if (!typingRef.current) {
      typingRef.current = true;
      socketRef.current?.emit('typing', { room: groupId, user: me });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, TYPING_TIMEOUT_MS);
  };

  /* ---------------- derived ---------------- */

  const members = useMemo(() => group?.members ?? [], [group]);
  const myRole = members.find((m) => m._id === me)?.role;
  const isAdmin = myRole === 'admin';
  const { openFile, viewer: fileViewer } = useFileViewer();
  const manage = useGroupManagement({ group, reload: loadGroup, onLeft: () => router.navigate('/groups' as Href) });
  // Web isAccessible: only admins can post unless the group is active.
  const canSend = !!group && (isAdmin || group.status === 'active');
  const remaining = (group?.messageCount ?? 0) - messages.length;
  const byId = useMemo(() => new Map(messages.map((m) => [m._id, m])), [messages]);
  const typingName = typingUser ? members.find((m) => m._id === typingUser)?.name ?? 'Someone' : null;

  // "@" mention suggestions for the word being typed.
  const mentionQuery = useMemo(() => {
    const match = /(?:^|\s)@([^@\n]*)$/.exec(text);
    return match ? match[1].toLowerCase() : null;
  }, [text]);
  const mentionOptions = useMemo(
    () =>
      mentionQuery === null
        ? []
        : members.filter((m) => m._id !== me && m.name?.toLowerCase().startsWith(mentionQuery)).slice(0, 5),
    [mentionQuery, members, me]
  );
  const pickMention = (m: GroupMember) => setText((t) => t.replace(/@([^@\n]*)$/, `@${m.name} `));

  /* ---------------- actions ---------------- */

  const send = useCallback(
    async (content: string, isFile = false) => {
      if (!me || !groupId) return;
      const reply = replyingTo;
      const mentionIds = isFile ? [] : findMentions(content, members, me);
      const localId = `local-${Date.now()}`;
      const optimistic: GroupMessage = {
        _id: localId,
        taskId: groupId,
        authorId: { _id: me, name: myName },
        content,
        isFile,
        replyTo: reply,
        mentionBy: mentionIds,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      setReplyingTo(null);
      try {
        const response = await postGroupMessage({
          taskId: groupId,
          authorId: me,
          content,
          isFile,
          replyTo: reply?._id,
          mentionBy: mentionIds,
        });
        const saved = response?.data;
        // Relay to the room, exactly like the web ("new message" with the API response).
        socketRef.current?.emit('new message', response);
        setMessages((prev) =>
          prev.map((m) =>
            m._id === localId ? { ...optimistic, _id: saved?._id ?? localId, createdAt: saved?.createdAt ?? optimistic.createdAt, pending: false } : m
          )
        );
        markRead(saved?._id);
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m._id !== localId));
        setReplyingTo(reply);
        toastError(e, 'Message not sent');
        throw e;
      }
    },
    [me, myName, groupId, members, replyingTo, markRead]
  );

  const onSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    stopTyping();

    if (editing) {
      setSending(true);
      try {
        const mentionIds = findMentions(value, members, me);
        await editGroupMessage(editing._id, value, mentionIds);
        setMessages((prev) => prev.map((m) => (m._id === editing._id ? { ...m, content: value, mentionBy: mentionIds } : m)));
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
      setText(value);
    } finally {
      setSending(false);
    }
  };

  const uploads = useChatUploads({
    upload: (file, options) => uploadChatFile(groupId ?? '', 'groupDoc', file, options),
    send: (url) => send(url, true),
  });

  const loadOlder = async () => {
    if (!groupId || loadingMore || loading || remaining <= 0) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const older = await fetchGroupMessages(groupId, next);
      setMessages((prev) => {
        const fresh = older.filter((m) => !prev.some((p) => p._id === m._id));
        return [...fresh, ...prev];
      });
      setPage(next);
    } catch (e) {
      toastError(e, 'Could not load older messages');
    } finally {
      setLoadingMore(false);
    }
  };

  const startReply = (m: GroupMessage) => {
    setActionFor(null);
    setEditing(null);
    setReplyingTo(m);
  };
  const startEdit = (m: GroupMessage) => {
    setActionFor(null);
    setReplyingTo(null);
    setEditing(m);
    setText(m.content);
  };
  const cancelCompose = () => {
    if (editing) setText('');
    setEditing(null);
    setReplyingTo(null);
  };

  /* ---------------- render ---------------- */

  const data = useMemo(() => [...messages].reverse(), [messages]);
  const files = useMemo(() => messages.filter((m) => m.isFile && !m.pending).reverse() as unknown as Comment[], [messages]);

  const renderItem = useCallback<ListRenderItem<GroupMessage>>(
    ({ item, index }) => {
      const mine = messageAuthorId(item) === me;
      const older = data[index + 1];
      const showName = !mine && (!older || messageAuthorId(older) !== messageAuthorId(item));
      const reply = typeof item.replyTo === 'string' ? byId.get(item.replyTo) : item.replyTo ?? undefined;
      return (
        <MessageBubble
          message={item}
          mine={mine}
          showName={showName}
          reply={item.replyTo ? reply ?? null : undefined}
          members={members}
          onLongPress={setActionFor}
          onOpenFile={openFile}
        />
      );
    },
    [me, data, byId, members, openFile]
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/groups' as Href));
  const openInfo = () => router.push(`/groups/${groupId}/info` as Href);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-100"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
    >
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Pressable
          onPress={goBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 active:opacity-70"
        >
          <SymbolView name={ICONS.back} size={20} tintColor="#000000" />
        </Pressable>
        <Pressable onPress={openInfo} accessibilityRole="button" accessibilityHint="Opens group info" className="flex-1 flex-row items-center gap-3">
          <Avatar name={group?.groupName} uri={resolveImageUrl(group?.image)} size={40} />
          <View className="flex-1">
            <Text className="text-base font-bold text-black" numberOfLines={1}>
              {group?.groupName ?? 'Group'}
            </Text>
            <Text className="text-xs font-medium text-black" numberOfLines={1}>
              {typingName ? `${typingName} is typing…` : group ? `${members.length} members` : ''}
            </Text>
          </View>
        </Pressable>
        {group ? (
          <DropdownMenu
            label="Group options"
            items={[
              { label: 'Group info', onPress: openInfo },
              { label: 'Media, links and docs', onPress: () => setMediaOpen(true) },
              { label: isAdmin ? 'Manage members' : 'View members', onPress: manage.openMembers },
              { label: 'Add members', onPress: manage.openAddMembers, hidden: !isAdmin },
              { label: 'Group settings', onPress: manage.openSettings, hidden: !isAdmin },
              { label: 'Change group photo', onPress: manage.changePhoto, hidden: !isAdmin },
              { label: 'Exit group', onPress: manage.leave, danger: true },
            ]}
          />
        ) : null}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <DotLoader label="Loading messages" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <SymbolView name={ICONS.lock} size={32} tintColor="#000000" />
          <Text className="text-center text-base font-bold text-black">{error}</Text>
        </View>
      ) : messages.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <SymbolView name={ICONS.groups} size={40} tintColor="#00214c" />
          <Text className="text-center text-base font-bold text-black">No messages yet</Text>
          <Text className="text-center text-sm text-black">Say hello to the group.</Text>
        </View>
      ) : (
        <FlatList
          inverted
          data={data}
          keyExtractor={(m) => m._id}
          renderItem={renderItem}
          contentContainerClassName="gap-1.5 px-3 py-4"
          keyboardShouldPersistTaps="handled"
          onEndReached={loadOlder}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={
            typingName ? (
              <View className="self-start rounded-2xl bg-white px-3 py-2.5">
                <DotLoader size={6} label={`${typingName} is typing`} />
              </View>
            ) : undefined
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="py-3">
                <DotLoader size={6} label="Loading older messages" />
              </View>
            ) : remaining > 0 ? (
              <Pressable onPress={loadOlder} className="items-center py-3">
                <Text className="text-[13px] font-semibold text-blue-600">Load older messages</Text>
              </Pressable>
            ) : undefined
          }
        />
      )}

      <UploadQueue items={uploads.items} onCancel={uploads.cancel} onRetry={uploads.retry} />

      {/* Composer */}
      {group && !error ? (
        canSend ? (
          <View className="border-t border-slate-200 bg-white px-3 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
            {/* Mention suggestions */}
            {mentionOptions.length > 0 && !editing ? (
              <View className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {mentionOptions.map((m, i) => (
                  <Pressable
                    key={m._id}
                    onPress={() => pickMention(m)}
                    className={`flex-row items-center gap-2.5 px-3 py-2 active:bg-slate-100 ${i ? 'border-t border-slate-100' : ''}`}
                  >
                    <Avatar name={m.name} uri={resolveImageUrl(m.image)} size={28} />
                    <Text className="text-sm font-semibold text-black">{m.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {replyingTo || editing ? (
              <View className="mb-2 flex-row items-center gap-2 rounded-xl border-l-4 border-primary bg-slate-100 px-3 py-2">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-black">
                    {editing ? 'Editing message' : `Replying to ${messageAuthorId(replyingTo!) === me ? 'yourself' : nameOf(replyingTo) ?? 'Someone'}`}
                  </Text>
                  {replyingTo ? (
                    <Text className="text-xs text-black" numberOfLines={1}>
                      {replyingTo.isFile ? 'File' : replyingTo.content}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={cancelCompose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
                  <SymbolView name={ICONS.close} size={14} tintColor="#000000" />
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
                  <SymbolView name={ICONS.attach} size={20} tintColor="#000000" />
                </Pressable>
              ) : null}
              <TextInput
                value={text}
                onChangeText={onChangeText}
                placeholder="Type a message… (@ to mention)"
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
                <SymbolView name={editing ? ICONS.check : ICONS.send} size={18} tintColor="#ffffff" />
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-center gap-2 border-t border-slate-200 bg-white px-4 py-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <SymbolView name={ICONS.lock} size={14} tintColor="#000000" />
            <Text className="text-[13px] font-medium text-black">Only admins can send messages</Text>
          </View>
        )
      ) : null}

      <MessageActions
        message={actionFor}
        canEdit={!!actionFor && messageAuthorId(actionFor) === me && !actionFor.isFile && !actionFor.pending}
        canReply={canSend && !!actionFor && !actionFor.pending}
        onClose={() => setActionFor(null)}
        onReply={startReply}
        onEdit={startEdit}
      />
      {manage.sheets}
      {fileViewer}
      <AttachMenu visible={attachOpen} onClose={() => setAttachOpen(false)} onPicked={uploads.add} />
      <AttachmentsSheet visible={mediaOpen} files={files} subtitle={group?.groupName} onClose={() => setMediaOpen(false)} />
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* Bubble                                                              */
/* ------------------------------------------------------------------ */

/** Text with "@Name" of mentioned members in bold (web renderMessageWithMentions). */
function MentionText({ content, mentioned, mine }: { content: string; mentioned: string[]; mine: boolean }) {
  if (!mentioned.length) {
    return <Text className={`text-[15px] leading-[21px] ${mine ? 'text-white' : 'text-black'}`}>{content}</Text>;
  }
  const escaped = mentioned.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = content.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'));
  return (
    <Text className={`text-[15px] leading-[21px] ${mine ? 'text-white' : 'text-black'}`}>
      {parts.map((part, i) =>
        part.startsWith('@') && mentioned.some((n) => part === `@${n}`) ? (
          <Text key={i} className={`font-bold ${mine ? 'text-sky-200' : 'text-blue-700'}`}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  showName,
  reply,
  members,
  onLongPress,
  onOpenFile,
}: {
  message: GroupMessage;
  mine: boolean;
  showName: boolean;
  /** undefined = not a reply; null = reply to a message that isn't loaded. */
  reply?: GroupMessage | null;
  members: GroupMember[];
  onLongPress: (m: GroupMessage) => void;
  onOpenFile: (f: ViewableFile) => void;
}) {
  const file = message.isFile ? parseFileComment(message.content) : null;
  const mentionedIds = (message.mentionBy ?? []).map((m) => (typeof m === 'string' ? m : m._id));
  const mentionedNames = members.filter((m) => mentionedIds.includes(m._id) && m.name).map((m) => m.name!) ;

  return (
    <View className={`max-w-[82%] gap-0.5 ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
      {showName ? <Text className="ml-1 text-[11px] font-bold text-black">{nameOf(message) ?? 'User'}</Text> : null}
      <Pressable
        onLongPress={message.pending ? undefined : () => onLongPress(message)}
        onPress={file ? () => onOpenFile(file) : undefined}
        delayLongPress={300}
        accessibilityHint={file ? "Tap to open, long press to reply" : "Long press to reply or edit"}
        className={`overflow-hidden rounded-2xl ${mine ? 'rounded-br-md bg-primary' : 'rounded-bl-md border border-slate-200 bg-white'} ${
          file?.isImage ? 'p-1' : 'px-3.5 py-2.5'
        } ${message.pending ? 'opacity-60' : ''}`}
      >
        {reply !== undefined ? (
          <View className={`mb-1.5 rounded-lg border-l-4 px-2.5 py-1.5 ${mine ? 'border-sky-300 bg-white/15' : 'border-primary bg-slate-100'}`}>
            <Text className={`text-[11px] font-bold ${mine ? 'text-white' : 'text-black'}`}>{nameOf(reply) ?? 'Someone'}</Text>
            <Text className={`text-xs ${mine ? 'text-white/90' : 'text-black'}`} numberOfLines={2}>
              {reply ? (reply.isFile ? 'File' : reply.content) : 'Original message'}
            </Text>
          </View>
        ) : null}

        {file?.isImage ? (
          <Image source={{ uri: file.url }} style={{ width: 220, height: 220, borderRadius: 14 }} contentFit="cover" />
        ) : file ? (
          <View className="flex-row items-center gap-2">
            <SymbolView name={ICONS.file} size={18} tintColor={mine ? '#ffffff' : '#00214c'} />
            <Text className={`flex-shrink text-sm font-semibold underline ${mine ? 'text-white' : 'text-black'}`} numberOfLines={1}>
              {file.name}
            </Text>
          </View>
        ) : (
          <MentionText content={message.content} mentioned={mentionedNames} mine={mine} />
        )}
      </Pressable>
      <Text className="mx-1 text-[10px] font-medium text-black">{message.pending ? 'Sending…' : formatMessageTime(message.createdAt)}</Text>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Long-press actions                                                  */
/* ------------------------------------------------------------------ */

function MessageActions({
  message,
  canEdit,
  canReply,
  onClose,
  onReply,
  onEdit,
}: {
  message: GroupMessage | null;
  canEdit: boolean;
  canReply: boolean;
  onClose: () => void;
  onReply: (m: GroupMessage) => void;
  onEdit: (m: GroupMessage) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <View className="mx-3 overflow-hidden rounded-2xl bg-white" style={{ marginBottom: insets.bottom + 12 }}>
          <Text className="border-b border-slate-100 px-4 py-3 text-[13px] text-black" numberOfLines={2}>
            {message.isFile ? 'File' : message.content}
          </Text>
          {canReply ? <ActionRow icon={ICONS.reply} label="Reply" onPress={() => onReply(message)} /> : null}
          {canEdit ? <ActionRow icon={ICONS.edit} label="Edit" onPress={() => onEdit(message)} /> : null}
          <ActionRow icon={ICONS.close} label="Cancel" onPress={onClose} />
        </View>
      </Pressable>
    </Modal>
  );
}

function ActionRow({ icon, label, onPress }: { icon: (typeof ICONS)[keyof typeof ICONS]; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center gap-3 border-t border-slate-100 px-4 py-3.5 active:bg-slate-50">
      <SymbolView name={icon} size={18} tintColor="#000000" />
      <Text className="text-[15px] text-black">{label}</Text>
    </Pressable>
  );
}
