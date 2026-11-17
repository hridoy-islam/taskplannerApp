import { Redirect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, type TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingLogoutButton } from '@/components/onboarding/logout-button';
import { ImageUploader } from '@/components/profile/image-uploader';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { KeyboardPaddingView } from '@/components/ui/keyboard-avoiding-view';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { getErrorMessage } from '@/lib/auth-errors';
import { resolveImageUrl } from '@/lib/image-url';
import { toast } from '@/lib/toast';
import { completePersonalInformation } from '@/redux/features/authSlice';
import { fetchUserProfile } from '@/redux/features/profileSlice';

/* ------------------------------------------------------------------ */
/* Form model (same fields and options as the website)                 */
/* ------------------------------------------------------------------ */

type Form = {
  jobTitle: string;
  bio: string;
  socialLinks: string[];
  isEmployed: boolean;
  companyType: string;
  companyName: string;
  companyAddress: string;
  companyWebsite: string;
  companyPhone: string;
  companyEmail: string;
  howDidYouHear: string;
  industryType: string;
  numberOfEmployees: string;
};

const EMPTY: Form = {
  jobTitle: '',
  bio: '',
  socialLinks: [],
  isEmployed: false,
  companyType: '',
  companyName: '',
  companyAddress: '',
  companyWebsite: '',
  companyPhone: '',
  companyEmail: '',
  howDidYouHear: '',
  industryType: '',
  numberOfEmployees: '',
};

type Option = { value: string; label: string };

const COMPANY_TYPES: Option[] = [
  { value: 'startup', label: 'Startup' },
  { value: 'agency', label: 'Agency' },
  { value: 'ngo', label: 'NGO' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'other', label: 'Other' },
];
const HEARD_FROM: Option[] = [
  { value: 'search', label: 'Search Engine' },
  { value: 'social', label: 'Social Media' },
  { value: 'friend', label: 'Friend/Colleague' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'other', label: 'Other' },
];
const INDUSTRIES: Option[] = [
  { value: 'it', label: 'IT & Technology' },
  { value: 'education', label: 'Education' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'other', label: 'Other' },
];
const COMPANY_SIZES: Option[] = ['1-10', '11-50', '51-200', '201-500', '500+'].map((v) => ({ value: v, label: v }));

type SectionId = 'profile' | 'company' | 'additional';
const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'profile', title: 'Profile' },
  { id: 'company', title: 'Company' },
  { id: 'additional', title: 'Additional Info' },
];

type Step = {
  id: string;
  section: SectionId;
  title: string;
  description: string;
  /** Can the user move on from this step? */
  done: (f: Form) => boolean;
  /** Steps that only apply when employed. */
  when?: (f: Form) => boolean;
};

const filled = (s: string) => s.trim() !== '';

const STEPS: Step[] = [
  { id: 'photo', section: 'profile', title: "Let's start with your profile picture", description: 'A professional photo helps others recognise you', done: () => true },
  { id: 'jobTitle', section: 'profile', title: 'What is your job title?', description: 'Let others know what you do professionally', done: (f) => filled(f.jobTitle) },
  { id: 'bio', section: 'profile', title: 'Tell us a bit about yourself', description: 'Share your background, expertise, or interests', done: (f) => filled(f.bio) },
  { id: 'socialLinks', section: 'profile', title: 'Any social profiles you want to share?', description: 'Connect with others through your social media', done: () => true },
  { id: 'isEmployed', section: 'company', title: 'Are you currently employed?', description: 'Let us know about your employment status', done: () => true },
  {
    id: 'companyBasics',
    section: 'company',
    title: 'Tell us about your company',
    description: 'Share the basic details about your workplace',
    done: (f) => filled(f.companyType) && filled(f.companyName),
    when: (f) => f.isEmployed,
  },
  {
    id: 'companyDetails',
    section: 'company',
    title: 'Additional company details',
    description: 'These details are optional but helpful',
    done: () => true,
    when: (f) => f.isEmployed,
  },
  { id: 'howDidYouHear', section: 'additional', title: 'How did you hear about us?', description: "We'd love to know how you discovered our platform", done: (f) => filled(f.howDidYouHear) },
  { id: 'industryType', section: 'additional', title: 'What industry do you work in?', description: 'This helps us tailor our content to your needs', done: (f) => filled(f.industryType) },
  { id: 'numberOfEmployees', section: 'additional', title: 'How large is your organisation?', description: 'Tell us about the size of your company', done: (f) => filled(f.numberOfEmployees) },
  { id: 'finish', section: 'additional', title: "You're all set!", description: 'Thank you for completing your profile information', done: () => true },
];

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

/**
 * "Complete your profile" for a verified user who isn't authorized yet (website: /personal-details).
 * One question per step, grouped into Profile → Company → Additional Info; the last step saves
 * everything and marks the account authorized, which lets the user into the app.
 */
export default function PersonalDetailsScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.auth.user);
  const profileImage = useAppSelector((state) => (state.profile as any)?.profileData?.image as string | undefined);
  const [form, setForm] = useState<Form>(EMPTY);
  const [stepId, setStepId] = useState(STEPS[0].id);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId: string | undefined = user?._id;
  useEffect(() => {
    if (userId) dispatch(fetchUserProfile(userId));
  }, [dispatch, userId]);

  if (user?.authorized) return <Redirect href="/" />;

  const steps = STEPS.filter((s) => !s.when || s.when(form));
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const sectionIndex = SECTIONS.findIndex((s) => s.id === step.section);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const goTo = (i: number) => {
    setError(null);
    setStepId(steps[Math.min(Math.max(i, 0), steps.length - 1)].id);
  };

  const submit = async () => {
    if (!userId) return;
    const f = form;
    const data: Record<string, unknown> = {};
    // Same field names as the website sends.
    if (filled(f.jobTitle)) data.jobTitle = f.jobTitle.trim();
    if (filled(f.bio)) data.bio = f.bio.trim();
    const links = f.socialLinks.map((l) => l.trim()).filter(Boolean);
    if (links.length) data.socialLinks = links;
    if (f.isEmployed) {
      if (filled(f.companyType)) data.companyType = f.companyType;
      if (filled(f.companyName)) data.companyName = f.companyName.trim();
      if (filled(f.companyWebsite)) data.companyWebsite = f.companyWebsite.trim();
      if (filled(f.companyAddress)) data.address = f.companyAddress.trim();
      if (filled(f.companyPhone)) data.phone = f.companyPhone.trim();
      if (filled(f.companyEmail)) data.companyEmail = f.companyEmail.trim();
    }
    if (filled(f.industryType)) data.industryType = f.industryType;
    if (filled(f.numberOfEmployees)) data.numberOfEmployees = f.numberOfEmployees;
    if (filled(f.howDidYouHear)) data.heardAboutUs = f.howDidYouHear;

    setError(null);
    setSubmitting(true);
    try {
      await dispatch(completePersonalInformation({ userId, profileData: data })).unwrap();
      toast.success('Profile completed successfully!');
      // authorized is now true → the redirect above takes the user into the app.
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your profile. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardPaddingView className="flex-1 bg-white" bottomInset={0}>
      <View className="flex-1" style={{ paddingTop: insets.top + 8 }}>
        {/* Header */}
        <View className="gap-4 px-5 pb-4">
          <OnboardingLogoutButton />
          <View>
            <Text className="text-[26px] font-bold text-black">Complete Your Profile</Text>
            <Text className="mt-1 text-sm text-black">Tell us about yourself to get the most out of Task Planner</Text>
          </View>
          <SectionTracker current={sectionIndex} />
        </View>

        {/* Question */}
        <ScrollView className="flex-1" contentContainerClassName="gap-5 px-5 pb-6" keyboardShouldPersistTaps="handled">
          {step.id === 'finish' ? (
            <View className="items-center gap-3 pt-10">
              <View className="h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={36} tintColor="#16a34a" />
              </View>
              <Text className="text-2xl font-bold text-black">{step.title}</Text>
              <Text className="text-center text-base text-black">{step.description}</Text>
            </View>
          ) : (
            <View className="gap-1">
              <Text className="text-xl font-bold text-black">{step.title}</Text>
              <Text className="text-sm text-black">{step.description}</Text>
            </View>
          )}

          <StepBody
            id={step.id}
            form={form}
            set={set}
            imageUri={resolveImageUrl(profileImage)}
            name={user?.name}
            onUploadPhoto={() => setUploaderOpen(true)}
          />

          {error ? <Text className="text-center text-sm font-medium text-red-600">{error}</Text> : null}
        </ScrollView>

        {/* Back / Next */}
        <View className="flex-row gap-3 border-t border-slate-200 px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          {index > 0 ? (
            <Button title="Back" variant="dark" onPress={() => goTo(index - 1)} disabled={submitting} className="h-12 flex-1 rounded-xl py-0" />
          ) : null}
          {isLast ? (
            <Button title="Finish" onPress={submit} loading={submitting} disabled={submitting} className="h-12 flex-1 rounded-xl py-0" />
          ) : (
            <Button title="Next" onPress={() => goTo(index + 1)} disabled={!step.done(form)} className="h-12 flex-1 rounded-xl py-0" />
          )}
        </View>
      </View>

      <ImageUploader
        open={uploaderOpen}
        onOpenChange={setUploaderOpen}
        entityId={userId}
        onUploadComplete={() => userId && dispatch(fetchUserProfile(userId))}
      />
    </KeyboardPaddingView>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function SectionTracker({ current }: { current: number }) {
  return (
    <View className="flex-row gap-2">
      {SECTIONS.map((s, i) => (
        <View key={s.id} className="flex-1 gap-1.5">
          <View className={`h-1.5 rounded-full ${i <= current ? 'bg-primary' : 'bg-slate-200'}`} />
          <Text className={`text-xs ${i === current ? 'font-bold' : 'font-medium'} text-black`}>{s.title}</Text>
        </View>
      ))}
    </View>
  );
}

function StepBody({
  id,
  form,
  set,
  imageUri,
  name,
  onUploadPhoto,
}: {
  id: string;
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
  imageUri?: string;
  name?: string;
  onUploadPhoto: () => void;
}) {
  switch (id) {
    case 'photo':
      return (
        <View className="items-center gap-4 py-4">
          <Avatar name={name} uri={imageUri} size={112} />
          <Button title="Upload Photo" variant="dark" onPress={onUploadPhoto} className="rounded-xl px-6" />
          <Text className="text-sm text-black">This step is optional but recommended</Text>
        </View>
      );
    case 'jobTitle':
      return (
        <Field label="Job Title / Position">
          <Input value={form.jobTitle} onChangeText={(t) => set('jobTitle', t)} placeholder="e.g. Senior Developer, Marketing Manager" />
        </Field>
      );
    case 'bio':
      return (
        <Field label="Bio">
          <Input
            value={form.bio}
            onChangeText={(t) => set('bio', t)}
            placeholder="I am a software developer with 5 years of experience..."
            multiline
            className="min-h-32 py-3"
            style={{ textAlignVertical: 'top' }}
          />
        </Field>
      );
    case 'socialLinks':
      return (
        <Field label="Social Links (optional)">
          <View className="gap-3">
            {form.socialLinks.map((link, i) => (
              <View key={i} className="flex-row items-center gap-2">
                <Input
                  value={link}
                  onChangeText={(t) => set('socialLinks', form.socialLinks.map((l, j) => (j === i ? t : l)))}
                  placeholder="https://linkedin.com/in/yourprofile"
                  autoCapitalize="none"
                  keyboardType="url"
                  className="flex-1"
                />
                <Pressable
                  onPress={() => set('socialLinks', form.socialLinks.filter((_, j) => j !== i))}
                  accessibilityRole="button"
                  accessibilityLabel="Remove link"
                  className="h-12 w-12 items-center justify-center rounded-xl bg-red-600 active:opacity-80"
                >
                  <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={18} tintColor="#ffffff" />
                </Pressable>
              </View>
            ))}
            <Button title="+ Add Social Link" variant="outline" onPress={() => set('socialLinks', [...form.socialLinks, ''])} className="rounded-xl" />
          </View>
        </Field>
      );
    case 'isEmployed':
      return (
        <View className="gap-3">
          <Choices
            options={[
              { value: 'yes', label: 'Yes, I am currently employed' },
              { value: 'no', label: 'No, not right now' },
            ]}
            value={form.isEmployed ? 'yes' : 'no'}
            onChange={(v) => set('isEmployed', v === 'yes')}
          />
          <Text className="text-sm text-black">
            {form.isEmployed ? "Great! We'll ask for some details about your workplace." : "That's okay! You can still carry on to the next section."}
          </Text>
        </View>
      );
    case 'companyBasics':
      return (
        <View className="gap-5">
          <Field label="Company Type">
            <Choices options={COMPANY_TYPES} value={form.companyType} onChange={(v) => set('companyType', v)} />
          </Field>
          <Field label="Company Name">
            <Input value={form.companyName} onChangeText={(t) => set('companyName', t)} placeholder="e.g. Acme Inc." />
          </Field>
        </View>
      );
    case 'companyDetails':
      return (
        <View className="gap-5">
          <Field label="Company Address">
            <Input value={form.companyAddress} onChangeText={(t) => set('companyAddress', t)} placeholder="e.g. 123 Business St, London" />
          </Field>
          <Field label="Company Website">
            <Input
              value={form.companyWebsite}
              onChangeText={(t) => set('companyWebsite', t)}
              placeholder="https://example.com"
              autoCapitalize="none"
              keyboardType="url"
            />
          </Field>
          <Field label="Company Phone">
            <Input value={form.companyPhone} onChangeText={(t) => set('companyPhone', t)} placeholder="+44 20 1234 5678" keyboardType="phone-pad" />
          </Field>
          <Field label="Company Email">
            <Input
              value={form.companyEmail}
              onChangeText={(t) => set('companyEmail', t)}
              placeholder="contact@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>
        </View>
      );
    case 'howDidYouHear':
      return <Choices options={HEARD_FROM} value={form.howDidYouHear} onChange={(v) => set('howDidYouHear', v)} />;
    case 'industryType':
      return <Choices options={INDUSTRIES} value={form.industryType} onChange={(v) => set('industryType', v)} />;
    case 'numberOfEmployees':
      return <Choices options={COMPANY_SIZES} value={form.numberOfEmployees} onChange={(v) => set('numberOfEmployees', v)} />;
    default:
      return null;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-[15px] font-semibold text-black">{label}</Text>
      {children}
    </View>
  );
}

function Input({ className = '', ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor="#64748b"
      className={`min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-[15px] text-black ${className}`}
      {...props}
    />
  );
}

/** Tappable list in place of the website's dropdowns — easier on a phone. */
function Choices({ options, value, onChange }: { options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <View className="gap-2.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            className={`flex-row items-center justify-between rounded-xl border px-4 py-3.5 ${on ? 'border-primary bg-primary' : 'border-slate-300 bg-white active:bg-slate-50'}`}
          >
            <Text className={`text-[15px] font-semibold ${on ? 'text-white' : 'text-black'}`}>{o.label}</Text>
            {on ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} tintColor="#ffffff" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
