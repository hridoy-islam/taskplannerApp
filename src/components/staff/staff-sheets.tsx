import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, TextInput, type TextInputProps, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Palette } from '@/constants/theme';
import {
  createStaff,
  fetchStaffMember,
  findUserByEmail,
  isAuthorized,
  STAFF_ROLE_OPTIONS,
  type StaffRole,
  updateColleague,
  updateStaff,
} from '@/lib/staff';
import { getErrorMessage, toast, toastError } from '@/lib/toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* Small form pieces                                                   */
/* ------------------------------------------------------------------ */

function Field({
  label,
  required,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; required?: boolean; error?: string; hint?: string }) {
  const disabled = input.editable === false;
  return (
    <View className="gap-1.5">
      <Text className="text-[13px] font-semibold text-slate-900">
        {label}
        {required ? <Text className="text-red-600"> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor="#64748b"
        autoCorrect={false}
        {...input}
        className={`h-12 rounded-xl border px-3.5 text-[15px] ${disabled ? 'bg-slate-100 text-slate-500' : 'bg-white text-black'} ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
      />
      {error ? (
        <Text className="text-xs font-medium text-red-600">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-slate-500">{hint}</Text>
      ) : null}
    </View>
  );
}

export function SwitchRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-slate-900">{label}</Text>
        {description ? <Text className="text-xs text-slate-500">{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: Palette.primary, false: '#cbd5e1' }}
        thumbColor="#ffffff"
        accessibilityLabel={label}
      />
    </View>
  );
}

function RolePicker({ value, onChange, error }: { value?: StaffRole; onChange: (r: StaffRole) => void; error?: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-[13px] font-semibold text-slate-900">
        Role<Text className="text-red-600"> *</Text>
      </Text>
      <View className="flex-row gap-2">
        {STAFF_ROLE_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`h-11 flex-1 items-center justify-center rounded-xl border ${
                selected ? 'border-primary bg-primary' : error ? 'border-red-500 bg-white' : 'border-slate-300 bg-white'
              }`}
            >
              <Text className={`text-[15px] font-semibold ${selected ? 'text-white' : 'text-slate-700'}`}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="text-xs font-medium text-red-600">{error}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit staff                                                 */
/* ------------------------------------------------------------------ */

type StaffFormSheetProps = {
  visible: boolean;
  /** Present when editing; absent when creating. */
  staffId?: string | null;
  /** Signed-in user's role: only a director ('company') can pick Manager vs Staff. */
  viewerRole?: string;
  companyId?: string;
  onClose: () => void;
  onSaved: () => void;
};

/** Remounts each time it opens, so the form always starts fresh. */
export function StaffFormSheet(props: StaffFormSheetProps) {
  return props.visible ? <StaffFormSheetContent {...props} /> : null;
}

type FormErrors = Partial<Record<'name' | 'email' | 'password' | 'role', string>>;

function StaffFormSheetContent({ visible, staffId, viewerRole, companyId, onClose, onSaved }: StaffFormSheetProps) {
  const editing = !!staffId;
  const canPickRole = viewerRole === 'company';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Managers can only create/keep staff accounts (web staffModule hardcodes role 'user').
  const [role, setRole] = useState<StaffRole | undefined>(canPickRole ? undefined : 'user');
  const [authorized, setAuthorized] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!staffId) return;
    let active = true;
    fetchStaffMember(staffId)
      .then((m) => {
        if (!active || !m) return;
        setName(m.name ?? '');
        setEmail(m.email ?? '');
        if (canPickRole && (m.role === 'creator' || m.role === 'user')) setRole(m.role);
        setAuthorized(isAuthorized(m));
      })
      .catch((e) => {
        if (!active) return;
        toastError(e, 'Could not load staff details');
        onCloseRef.current();
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [staffId, canPickRole]);

  const validate = () => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Name is required';
    else if (editing && name.trim().length < 2) next.name = 'Name must be at least 2 characters';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Invalid email address';
    if (!editing && password.length < 6) next.password = 'Password must be at least 6 characters';
    if (editing && password.length > 0 && password.length < 6) next.password = 'Password must be at least 6 characters';
    if (!role) next.role = 'Role is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate() || !role) return;
    if (!companyId) {
      toast.error('No company found', 'Your account is not linked to a company.');
      return;
    }
    setSaving(true);
    try {
      if (editing && staffId) {
        await updateStaff(staffId, { name, email, role, authorized, companyId, password });
        toast.success('Staff updated', `${name.trim()} has been updated.`);
      } else {
        await createStaff({ name, email, password, role, authorized, companyId });
        toast.success('Staff created', `${name.trim()} has been added.`);
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(
        editing ? 'Update failed' : 'Could not create staff',
        getErrorMessage(e, editing ? 'Could not update user.' : 'Failed to create user. Email might exist.')
      );
    } finally {
      setSaving(false);
    }
  };

  const clear = (key: keyof FormErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  return (
    <Sheet
      visible={visible}
      title={editing ? 'Edit Staff' : 'Create New Staff'}
      subtitle={editing ? 'Update role or personal details.' : 'Add a new member to your company.'}
      onClose={saving ? () => {} : onClose}
      footer={
        <View className="flex-row gap-3">
          <Button title="Cancel" variant="dark" onPress={onClose} disabled={saving} className="h-12 flex-1 rounded-xl py-0" />
          <Button
            title={editing ? 'Save Changes' : 'Save Staff'}
            onPress={submit}
            loading={saving}
            disabled={loading}
            className="h-12 flex-1 rounded-xl py-0"
          />
        </View>
      }
    >
      {loading ? (
        <View className="h-48 items-center justify-center">
          <ActivityIndicator color={Palette.primary} />
        </View>
      ) : (
        <View className="gap-4 px-5">
          {canPickRole ? (
            <RolePicker
              value={role}
              error={errors.role}
              onChange={(r) => {
                setRole(r);
                clear('role');
              }}
            />
          ) : null}
          <Field
            label="Full Name"
            required
            value={name}
            onChangeText={(t) => {
              setName(t);
              clear('name');
            }}
            placeholder="Enter full name"
            autoCapitalize="words"
            error={errors.name}
          />
          <Field
            label="Email"
            required={!editing}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clear('email');
            }}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!editing}
            hint={editing ? 'Email cannot be changed directly.' : undefined}
            error={errors.email}
          />
          <Field
            label={editing ? 'New Password (Optional)' : 'Password'}
            required={!editing}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clear('password');
            }}
            placeholder={editing ? 'Leave blank to keep current' : '******'}
            secureTextEntry
            autoCapitalize="none"
            error={errors.password}
          />
          <SwitchRow
            label={editing ? 'Authorize User' : 'Authorized'}
            description={editing ? 'Grant this user valid status and access.' : 'Grant immediate access'}
            value={authorized}
            onChange={setAuthorized}
          />
        </View>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Add by email (top bar "Add colleague" and the associate page)       */
/* ------------------------------------------------------------------ */

type AddByEmailSheetProps = {
  visible: boolean;
  /** Whose colleague list the found user is added to. */
  ownerId?: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  /** Called with the user that was added. */
  onAdded?: (user: { _id: string; name?: string; email?: string }) => void;
};

export function AddByEmailSheet(props: AddByEmailSheetProps) {
  return props.visible ? <AddByEmailSheetContent {...props} /> : null;
}

function AddByEmailSheetContent({
  visible,
  ownerId,
  title = 'Add Colleague',
  subtitle = 'Quick add by email.',
  onClose,
  onAdded,
}: AddByEmailSheetProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    if (!ownerId) return;
    setSaving(true);
    try {
      const found = await findUserByEmail(email);
      if (!found?._id) {
        setError('User not found');
        return;
      }
      if (found._id === ownerId) {
        setError("You can't add yourself");
        return;
      }
      await updateColleague(ownerId, found._id, 'add');
      toast.success(`${found.name ?? 'User'} has been added`);
      onAdded?.(found);
      onClose();
    } catch (e) {
      toast.error('Error adding user', getErrorMessage(e, 'User not found'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={saving ? () => {} : onClose}
      footer={
        <View className="flex-row gap-3">
          <Button title="Cancel" variant="dark" onPress={onClose} disabled={saving} className="h-12 flex-1 rounded-xl py-0" />
          <Button title="Add" onPress={submit} loading={saving} disabled={!email.trim()} className="h-12 flex-1 rounded-xl py-0" />
        </View>
      }
    >
      <View className="px-5">
        <Field
          label="Email"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          placeholder="email@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          error={error ?? undefined}
        />
      </View>
    </Sheet>
  );
}
