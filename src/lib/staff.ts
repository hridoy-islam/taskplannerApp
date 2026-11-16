import axiosInstance from './axios';

/* ---------------------------------------------------------------------------
 * Staff management (same endpoints as the web companyModule/users and staffModule/users pages).
 * Roles: 'company' = company director, 'creator' = manager, 'user' = staff.
 * ------------------------------------------------------------------------- */

export type StaffRole = 'creator' | 'user';

export type StaffMember = {
  _id: string;
  name: string;
  email: string;
  role: string;
  image?: string;
  isDeleted?: boolean;
  isValided?: boolean;
  authorized?: boolean;
  company?: string | { _id: string; name?: string };
  colleagues?: StaffMember[];
};

export const STAFF_ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'user', label: 'Staff' },
  { value: 'creator', label: 'Manager' },
];

/** Only the company director sees the "Add colleague" button in the top bar. */
export const isCompanyDirector = (role?: string) => role === 'company';

/** Company directors and managers can open the Staff page. */
export const canManageStaff = (role?: string) => role === 'company' || role === 'creator';

export function roleLabel(role?: string) {
  if (role === 'creator') return 'Manager';
  if (role === 'user') return 'Staff';
  if (role === 'company') return 'Director';
  return role || 'User';
}

export const isAuthorized = (m: Pick<StaffMember, 'isValided' | 'authorized'>) => !!(m.isValided && m.authorized);

export function idOf(ref?: string | { _id: string } | null) {
  if (!ref) return undefined;
  return typeof ref === 'string' ? ref : ref._id;
}

/** Company the signed-in user manages staff for: a director is the company; a manager belongs to one. */
export function staffCompanyId(user?: { _id?: string; role?: string; company?: any } | null) {
  if (!user) return undefined;
  if (user.role === 'company') return user._id;
  return idOf(user.company);
}

/* ---------------------------------------------------------------------------
 * Lists.
 * ------------------------------------------------------------------------- */

export type StaffPage = { items: StaffMember[]; totalPages: number };

export const STAFF_PAGE_SIZE = 100;

/**
 * Staff of a company. Directors see managers and staff (optionally one role);
 * managers only ever see staff (web ManageUserTableList hardcodes role=user).
 */
export async function fetchStaff(input: {
  companyId: string;
  viewerRole?: string;
  page?: number;
  searchTerm?: string;
  role?: StaffRole | null;
}): Promise<StaffPage> {
  const { companyId, viewerRole, page = 1, searchTerm = '', role } = input;
  // Built by hand: the API expects repeated `role=` keys (axios would send `role[]=`).
  let url = `/users?page=${page}&limit=${STAFF_PAGE_SIZE}&searchTerm=${encodeURIComponent(searchTerm)}&company=${encodeURIComponent(companyId)}`;
  if (viewerRole !== 'company') url += '&role=user';
  else if (role) url += `&role=${role}`;
  else url += '&role=user&role=creator';

  const res = await axiosInstance.get(url);
  const data = res.data?.data;
  return {
    items: Array.isArray(data?.result) ? data.result : [],
    totalPages: Number(data?.meta?.totalPage) || 1,
  };
}

export async function fetchStaffMember(userId: string): Promise<StaffMember> {
  const res = await axiosInstance.get(`/users/${userId}`);
  return res.data?.data;
}

/** Everyone active in the company (the "Directory search" on the associate page). */
export async function fetchCompanyMembers(companyId: string): Promise<StaffMember[]> {
  const res = await axiosInstance.get(`/users?company=${encodeURIComponent(companyId)}&isDeleted=false&limit=all`);
  const result = res.data?.data?.result;
  return Array.isArray(result) ? result : [];
}

/** Exact-email lookup; undefined when nobody matches. */
export async function findUserByEmail(email: string): Promise<StaffMember | undefined> {
  const res = await axiosInstance.get(`/users?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  return res.data?.data?.result?.[0];
}

/* ---------------------------------------------------------------------------
 * Mutations.
 * ------------------------------------------------------------------------- */

/** Creates a staff account in the company (web CreateUser → POST /auth/signup). */
export async function createStaff(input: {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  authorized: boolean;
  companyId: string;
}) {
  await axiosInstance.post('/auth/signup', {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    role: input.role,
    company: input.companyId,
    authorized: input.authorized,
    isValided: input.authorized,
  });
}

export async function updateStaff(
  userId: string,
  input: { name: string; email: string; role: StaffRole; authorized: boolean; companyId: string; password?: string }
) {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    company: input.companyId,
    authorized: input.authorized,
    isValided: input.authorized,
  };
  if (input.password && input.password.length >= 6) payload.password = input.password;
  await axiosInstance.patch(`/users/${userId}`, payload);
}

export async function setStaffActive(userId: string, active: boolean) {
  await axiosInstance.patch(`/users/${userId}`, { isDeleted: !active });
}

export async function setStaffAuthorized(userId: string, authorized: boolean) {
  await axiosInstance.patch(`/users/${userId}`, { isValided: authorized, authorized });
}

/** Adds/removes `colleagueId` in `userId`'s colleague list (their team / contacts). */
export async function updateColleague(userId: string, colleagueId: string, action: 'add' | 'remove') {
  await axiosInstance.patch(`/users/addmember/${userId}`, { colleagueId, action });
}
