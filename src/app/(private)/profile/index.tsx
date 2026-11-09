import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { Page } from '@/components/layout/page';
import { ScreenHeader } from '@/components/layout/screen-header';
import { ImageUploader } from '@/components/profile/image-uploader';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import axiosInstance from '@/lib/axios';
import { toast, toastError } from '@/lib/toast';
import { fetchUserProfile, updateUserProfile } from '@/redux/features/profileSlice';


type ProfileForm = { name: string; email: string; phone: string; address: string };

export default function ProfileScreen() {
  const dispatch = useAppDispatch();
  const user = useCurrentUser();
  const saving = useAppSelector((state) => state.profile.loading);

  // Unsaved edits on top of the loaded profile.
  const [edits, setEdits] = useState<Partial<ProfileForm> | null>(null);
  const dirty = edits !== null;
  const form: ProfileForm = {
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    ...edits,
  };
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  const onPhotoUploaded = async () => {
    if (user?._id) await dispatch(fetchUserProfile(user._id));
    toast.success('Profile picture updated');
  };

  const setField = (key: keyof ProfileForm) => (value: string) => {
    setEdits((e) => ({ ...e, [key]: value }));
  };

  const onSave = async () => {
    if (!user?._id) return;
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast.error('Invalid email', 'Enter a valid email address.');
      return;
    }

    try {
      await dispatch(
      updateUserProfile({
        userId: user._id,
        profileData: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        },
      })
      ).unwrap();
      setEdits(null);
      toast.success('Profile updated');
    } catch (e) {
      toastError(e, 'Failed to update profile');
    }
  };

  return (
    <Page>
      <ScreenHeader title="Profile" fallbackHref="/home" />

      <Card className="items-center gap-3 py-8">
        <Pressable
          onPress={() => setUploaderOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Change profile picture"
          className="active:opacity-80"
        >
          <Avatar name={user?.name} uri={user?.image} size={96} />
          <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600">
            <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={15} tintColor="#ffffff" />
          </View>
        </Pressable>
        <View className="items-center gap-1">
          <Text className="text-xl font-extrabold tracking-tight text-slate-900">{user?.name ?? 'User'}</Text>
          {user?.role ? (
            <View className="rounded-full bg-brand-soft px-3 py-1">
              <Text className="text-xs font-semibold capitalize text-primary">{user.role}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card className="gap-4">
        <ProfileField label="Name" value={form.name} onChangeText={setField('name')} autoCapitalize="words" />
        <ProfileField
          label="Email"
          value={form.email}
          onChangeText={setField('email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ProfileField label="Phone" value={form.phone} onChangeText={setField('phone')} keyboardType="phone-pad" />
        <ProfileField label="Address" value={form.address} onChangeText={setField('address')} />

        <View className="gap-3 pt-1">
          <Button title="Update Profile" onPress={onSave} loading={saving} disabled={!dirty} />
          <Button title="Change Password" variant="dark" onPress={() => setPasswordOpen(true)} />
        </View>
      </Card>

      <ImageUploader
        open={uploaderOpen}
        onOpenChange={setUploaderOpen}
        entityId={user?._id}
        onUploadComplete={onPhotoUploaded}
      />

      <ChangePasswordModal userId={user?._id} visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </Page>
  );
}

function ProfileField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-bold text-slate-900">{label}:</Text>
      <TextInput
        {...props}
        placeholder={`Enter your ${label.toLowerCase()}`}
        placeholderTextColor="#94a3b8"
        className="border-b border-slate-200 pb-2 pt-1 text-[15px] text-slate-900"
        accessibilityLabel={label}
      />
    </View>
  );
}

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

function ChangePasswordModal({
  userId,
  visible,
  onClose,
}: {
  userId?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = useState(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState<Partial<typeof EMPTY_PASSWORDS>>({});
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setValues(EMPTY_PASSWORDS);
    setErrors({});
    onClose();
  };

  const set = (key: keyof typeof EMPTY_PASSWORDS) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    // Same rules as the web app.
    const next: Partial<typeof EMPTY_PASSWORDS> = {};
    if (values.currentPassword.length < 6) next.currentPassword = 'Current password must be at least 6 characters';
    if (values.newPassword.length < 6) next.newPassword = 'New password must be at least 6 characters';
    if (values.confirmPassword !== values.newPassword) next.confirmPassword = "Passwords don't match";
    setErrors(next);
    if (Object.keys(next).length || !userId) return;

    setSubmitting(true);
    try {
      await axiosInstance.patch(`/auth/${userId}/change-password`, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Password changed');
      close();
    } catch (error) {
      toastError(error, 'Password not changed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center bg-black/60 px-5"
      >
        <Pressable className="absolute inset-0" onPress={close} accessibilityLabel="Close" />
        <View className="w-full max-w-md gap-4 rounded-2xl bg-white p-5">
          <Text className="text-lg font-bold text-slate-900">Change Password</Text>

          <AuthField
            label="Current Password"
            password
            value={values.currentPassword}
            onChangeText={set('currentPassword')}
            error={errors.currentPassword}
          />
          <AuthField
            label="New Password"
            password
            value={values.newPassword}
            onChangeText={set('newPassword')}
            error={errors.newPassword}
          />
          <AuthField
            label="Confirm New Password"
            password
            value={values.confirmPassword}
            onChangeText={set('confirmPassword')}
            error={errors.confirmPassword}
          />

          <View className="flex-row gap-3">
            <Button title="Cancel" variant="dark" onPress={close} className="flex-1" />
            <Button title="Update Password" onPress={submit} loading={submitting} className="flex-1" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
