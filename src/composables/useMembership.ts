import { computed, ref } from 'vue';
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  createMemberApiClient,
  type MemberStatus,
  type ManagedImageInput,
} from '@/src/services/memberApiClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || window.location.origin;
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && apiBaseUrl);
const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const session = ref<Session | null>(null);
const memberStatus = ref<MemberStatus | null>(null);
const initialized = ref(false);
const isLoading = ref(false);
const error = ref<string | null>(null);
const passwordRecovery = ref(false);
let initializePromise: Promise<void> | null = null;

const api = createMemberApiClient({
  baseUrl: apiBaseUrl,
  getAccessToken: async () => session.value?.access_token || null,
});

async function refreshStatus(): Promise<void> {
  if (!session.value) {
    memberStatus.value = null;
    return;
  }
  try {
    memberStatus.value = await api.getStatus();
    error.value = null;
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'member_api_error';
  }
}

function readManagedTextPreference(): boolean {
  try {
    const settings = JSON.parse(localStorage.getItem('app-settings') || '{}') as {
      memberManagedTextEnabled?: boolean;
    };
    return settings.memberManagedTextEnabled === true;
  } catch {
    return false;
  }
}

export function canUseManagedText(): boolean {
  return Boolean(session.value && memberStatus.value && readManagedTextPreference());
}

export async function generateManagedText(input: {
  prompt: string;
  idempotencyKey: string;
  operation: 'analysis' | 'generation' | 'regeneration' | 'deep_update' | 'blind_review';
  workflowId?: string;
}): Promise<{
  text: string;
  workflowId: string;
  workflow: { callCount: number; generationCount: number; deepUpdateCount: number };
}> {
  try {
    const result = await api.generate({
      ...input,
      provider: 'gemini-3.6-flash',
    });
    if (memberStatus.value) memberStatus.value.bonusBalance = result.bonusBalance;
    if (result.output.type !== 'text' || !result.output.text) {
      throw new Error('managed_text_response_invalid');
    }
    return { text: result.output.text, workflowId: result.workflowId, workflow: result.workflow };
  } catch (generationError) {
    await refreshStatus();
    throw generationError;
  }
}

export function useMembership() {
  async function initialize() {
    if (initializePromise) return initializePromise;
    initializePromise = (async () => {
      if (!supabase) {
        initialized.value = true;
        return;
      }
      const { data } = await supabase.auth.getSession();
      session.value = data.session;
      await refreshStatus();
      supabase.auth.onAuthStateChange((event, nextSession) => {
        session.value = nextSession;
        passwordRecovery.value = event === 'PASSWORD_RECOVERY';
        void refreshStatus();
      });
      initialized.value = true;
    })();
    return initializePromise;
  }

  async function signInWithGitHub() {
    if (!supabase) throw new Error('member_service_unavailable');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    });
    if (authError) throw authError;
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) throw new Error('member_service_unavailable');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;
  }

  async function signUpWithEmail(email: string, password: string, nickname: string) {
    if (!supabase) throw new Error('member_service_unavailable');
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: nickname.trim() || email.split('@')[0] },
      },
    });
    if (authError) throw authError;
  }

  async function requestPasswordReset(email: string) {
    if (!supabase) throw new Error('member_service_unavailable');
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (authError) throw authError;
  }

  async function updatePassword(password: string) {
    if (!supabase) throw new Error('member_service_unavailable');
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) throw authError;
    passwordRecovery.value = false;
  }

  async function updateProfile(input: { nickname?: string; email?: string }) {
    if (!supabase) throw new Error('member_service_unavailable');
    const attributes: { email?: string; data?: Record<string, string> } = {};
    if (input.email && input.email !== session.value?.user.email) attributes.email = input.email;
    if (input.nickname !== undefined) attributes.data = { display_name: input.nickname.trim() };
    const { data, error: authError } = await supabase.auth.updateUser(attributes);
    if (authError) throw authError;
    if (session.value && data.user) session.value = { ...session.value, user: data.user };
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    session.value = null;
    memberStatus.value = null;
  }

  async function bootstrap(turnstileToken: string) {
    isLoading.value = true;
    try {
      await api.bootstrap(turnstileToken);
      await refreshStatus();
    } finally {
      isLoading.value = false;
    }
  }

  async function checkIn(turnstileToken: string) {
    isLoading.value = true;
    try {
      const status = await api.checkIn(turnstileToken);
      memberStatus.value = status;
    } finally {
      isLoading.value = false;
    }
  }

  async function createCheckout(bonus: number) {
    const { url } = await api.createCheckout(bonus);
    window.location.assign(url);
  }

  async function upgradeAbstractQuota(targetQuota: 100 | 500) {
    const result = await api.upgradeAbstractQuota(targetQuota);
    await refreshStatus();
    return result;
  }

  async function managedGenerate(input: {
    idempotencyKey: string;
    provider: 'gemini-3.6-flash' | 'nano-banana-pro' | 'gpt-image-2';
    operation:
      | 'analysis'
      | 'generation'
      | 'regeneration'
      | 'deep_update'
      | 'image_generation'
      | 'blind_review';
    workflowId?: string;
    prompt: string;
    images?: ManagedImageInput[];
    size?: '1024x1024' | '1024x1536' | '1536x1024';
  }) {
    try {
      const result = await api.generate(input);
      if (memberStatus.value) memberStatus.value.bonusBalance = result.bonusBalance;
      return result.output;
    } catch (generationError) {
      await refreshStatus();
      throw generationError;
    }
  }

  return {
    configured: isConfigured,
    turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '',
    initialized: computed(() => initialized.value),
    isLoading: computed(() => isLoading.value),
    isAuthenticated: computed(() => Boolean(session.value)),
    passwordRecovery: computed(() => passwordRecovery.value),
    user: computed<User | null>(() => session.value?.user || null),
    status: computed(() => memberStatus.value),
    error: computed(() => error.value),
    initialize,
    refreshStatus,
    signInWithGitHub,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    updatePassword,
    updateProfile,
    signOut,
    bootstrap,
    checkIn,
    createCheckout,
    upgradeAbstractQuota,
    managedGenerate,
    memberApi: api,
  };
}
