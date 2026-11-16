import axiosInstance from './axios';

/* ---------------------------------------------------------------------------
 * Types (same shapes as the web CompanyGroupPage / CompanyGroupChat).
 * ------------------------------------------------------------------------- */

export type GroupRole = 'admin' | 'member';
export type GroupStatus = 'active' | 'archived';

type UserRef = { _id: string; name?: string; email?: string; image?: string };

/** Row in the group list (`GET /group/single`): members are ids + roles only. */
export type GroupSummary = {
  _id: string;
  groupName: string;
  description?: string;
  status: GroupStatus;
  image?: string;
  creator?: UserRef;
  members: { _id: string; role?: GroupRole }[];
  unreadMessageCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type GroupMember = UserRef & { role: GroupRole; acceptInvitation?: boolean; lastMessageReadId?: string };

/** Full group (`GET /group/single/:id`). */
export type GroupDetail = Omit<GroupSummary, 'members' | 'unreadMessageCount'> & {
  members: GroupMember[];
  messageCount: number;
};

export type GroupMessage = {
  _id: string;
  /** Group id (the API reuses the task-comment field name). */
  taskId: string;
  authorId: string | { _id: string; name?: string };
  content: string;
  isFile?: boolean;
  /** Id when loaded from the API; the full message when added locally. */
  replyTo?: string | GroupMessage | null;
  mentionBy?: (string | UserRef)[];
  createdAt?: string;
  /** Local-only: still sending. */
  pending?: boolean;
};

export const GROUP_MESSAGE_PAGE = 50;

const authorIdOf = (m: GroupMessage) => (typeof m.authorId === 'string' ? m.authorId : m.authorId?._id);
export { authorIdOf as messageAuthorId };

/* ---------------------------------------------------------------------------
 * Groups.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * The API returns `null` in place of users that were deleted (members, creator,
 * message authors, mentions). These clean that up once, here, so screens never
 * hit "Cannot read properties of null (reading '_id')".
 * ------------------------------------------------------------------------- */

const isRef = (v: any): v is { _id: string } => !!v && typeof v === 'object' && !!v._id;

function cleanMembers<T>(members: any): T[] {
  return Array.isArray(members) ? (members.filter(isRef) as T[]) : [];
}

function cleanGroup<T extends { members: any; creator?: any }>(group: T): T {
  return { ...group, members: cleanMembers(group.members), creator: isRef(group.creator) ? group.creator : undefined };
}

function cleanMessage(m: GroupMessage): GroupMessage {
  const author: any = m.authorId;
  return {
    ...m,
    authorId: typeof author === 'string' ? author : isRef(author) ? author : { _id: '', name: 'Deleted user' },
    mentionBy: Array.isArray(m.mentionBy) ? m.mentionBy.filter((x) => typeof x === 'string' || isRef(x)) : [],
    replyTo: m.replyTo && typeof m.replyTo === 'object' && !m.replyTo._id ? null : m.replyTo,
  };
}

/** Groups I'm a member of, with unread counts. */
export async function fetchGroups(): Promise<GroupSummary[]> {
  const res = await axiosInstance.get('/group/single');
  const data = res.data?.data;
  return Array.isArray(data) ? data.filter(isRef).map((g) => cleanGroup(g as GroupSummary)) : [];
}

/** Creates a group with me as admin and the picked people as members (web onSubmit). */
export async function createGroup(input: { groupName: string; me: { _id: string; name?: string }; memberIds: string[] }) {
  await axiosInstance.post('/group', {
    groupName: input.groupName,
    description: 'A new group created by the user.',
    creator: input.me._id,
    status: 'active',
    members: [
      { _id: input.me._id, role: 'admin', acceptInvitation: true, name: input.me.name },
      ...input.memberIds.map((id) => ({ _id: id, role: 'member', acceptInvitation: true })),
    ],
  });
}

export async function fetchGroup(groupId: string): Promise<GroupDetail> {
  const res = await axiosInstance.get(`/group/single/${groupId}`);
  const data = res.data?.data;
  return data ? cleanGroup(data as GroupDetail) : data;
}

export async function updateGroup(groupId: string, data: { groupName?: string; description?: string; status?: GroupStatus }) {
  await axiosInstance.patch(`/group/single/${groupId}`, data);
}

export async function addGroupMembers(groupId: string, userIds: string[]) {
  await Promise.all(userIds.map((userId) => axiosInstance.post('/group/addmember', { groupId, userId })));
}

export async function removeGroupMember(groupId: string, userId: string) {
  await axiosInstance.post('/group/removemember', { groupId, userId });
}

export async function setGroupMemberRole(groupId: string, userId: string, role: GroupRole) {
  await axiosInstance.post('/group/updateuserrole', { groupId, userId, role });
}

export async function markGroupRead(groupId: string, userId: string, messageId: string) {
  await axiosInstance.post('/group/updatereadmessage', { groupId, userId, messageId });
}

type UploadFile = { uri: string; name: string; type: string } | File;

/** Uploads a new group photo (the API saves it on the group). */
export async function uploadGroupImage(groupId: string, file: UploadFile) {
  const form = new FormData();
  form.append('entityId', groupId);
  form.append('file_type', 'groupImg');
  form.append('file', file as any);
  await axiosInstance.post('/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } });
}

/* ---------------------------------------------------------------------------
 * Messages.
 * ------------------------------------------------------------------------- */

/** One page of messages, oldest first. Page 1 is the newest 50 (reverse pagination). */
export async function fetchGroupMessages(groupId: string, page = 1): Promise<GroupMessage[]> {
  const res = await axiosInstance.get(`/groupMessage/${groupId}`, { params: { page, limit: GROUP_MESSAGE_PAGE } });
  const data = res.data?.data;
  return Array.isArray(data) ? data.filter(isRef).map((m) => cleanMessage(m as GroupMessage)) : [];
}

/** Posts a message; resolves with the full API response (sent on as the socket "new message" payload). */
export async function postGroupMessage(input: {
  taskId: string;
  authorId: string;
  content: string;
  isFile?: boolean;
  replyTo?: string;
  mentionBy?: string[];
}) {
  const res = await axiosInstance.post('/groupMessage', input);
  return res.data as { success: boolean; data: GroupMessage & { authorName?: string; taskName?: string } };
}

export async function editGroupMessage(messageId: string, content: string, mentionBy: string[]) {
  await axiosInstance.patch(`/groupMessage/${messageId}`, { content, mentionBy });
}

/** Uploads a chat file and returns its URL (sent as the message content, like the web). */
export async function uploadGroupFile(groupId: string, file: UploadFile) {
  const form = new FormData();
  form.append('entityId', groupId);
  form.append('file_type', 'groupDoc');
  form.append('file', file as any);
  const res = await axiosInstance.post('/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return (res.data?.data?.fileUrl || res.data?.url || res.data?.data?.url) as string;
}

/** Ids of members mentioned as "@Name" in the text (web handleCommentSubmit). */
export function findMentions(content: string, members: GroupMember[], me?: string) {
  return members.filter((m) => m._id !== me && m.name && content.includes(`@${m.name}`)).map((m) => m._id);
}

/** Normalises a socket "message received" payload (web messageReceivedHandler). */
export function normaliseIncomingGroupMessage(payload: any): (GroupMessage & { taskName?: string }) | null {
  const data = payload?.data ?? payload;
  if (!data || typeof data !== 'object' || !data.taskId) return null;
  return {
    _id: data._id || `remote-${Date.now()}`,
    taskId: String(data.taskId),
    authorId: { _id: typeof data.authorId === 'object' ? data.authorId?._id : data.authorId, name: data.authorName ?? data.authorId?.name },
    content: data.content ?? '',
    isFile: !!data.isFile,
    replyTo: data.replyTo ?? null,
    mentionBy: Array.isArray(data.mentionBy) ? data.mentionBy.filter((x: any) => typeof x === 'string' || isRef(x)) : [],
    createdAt: data.createdAt ?? new Date().toISOString(),
    taskName: data.taskName,
  };
}
