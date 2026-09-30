import { computed, ref } from 'vue';
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  createMemberApiClient,
  type JevConsent,
  type JevReviewSummary,
  type MemberStatus,
  type ManagedImageInput,
} from '@/src/services/memberApiClient';
import {
  hasEnabledMGAResearchAgent,
  MGA_RESEARCH_AGENT_ID,
} from '@/lib/capabilities/managedResearchCapabilities';
import { normalizeMemberTextModel, type AcceptedMemberTextModel } from '@/lib/llm/memberTextModels';

const directSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const productionSupabaseProxyPath = ['rad-sci.org', 'www.rad-sci.org'].includes(
  window.location.hostname
)
  ? '/supabase'
  : '';
const supabaseProxyPath =
  import.meta.env.VITE_SUPABASE_PROXY_PATH?.trim() || productionSupabaseProxyPath;
const supabaseUrl = supabaseProxyPath
  ? new URL(supabaseProxyPath, window.location.origin).toString().replace(/\/$/, '')
  : directSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const isConfigured = Boolean(directSupabaseUrl && supabaseAnonKey);
const supabaseProjectRef = directSupabaseUrl
  ? new URL(directSupabaseUrl).hostname.split('.')[0]
  : '';
const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: `sb-${supabaseProjectRef}-auth-token`,
      },
    })
  : null;

const session = ref<Session | null>(null);
const memberStatus = ref<MemberStatus | null>(null);
const jevConsent = ref<JevConsent | null>(null);
const initialized = ref(false);
const isLoading = ref(false);
const isStatusLoading = ref(false);
const error = ref<string | null>(null);
const passwordRecovery = ref(false);
let initializePromise: Promise<void> | null = null;
let statusRefreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !data.session) return null;
  session.value = data.session;
  return data.session.access_token;
}

const api = createMemberApiClient({
  baseUrl: window.location.origin,
  fallbackBaseUrls: configuredApiBaseUrl ? [configuredApiBaseUrl] : [],
  getAccessToken: async () => session.value?.access_token || null,
  refreshAccessToken,
});
const typesafeJevEnabled = import.meta.env.VITE_TYPESAFE_JEV_ENABLED?.trim() === 'true';

async function refreshStatus(): Promise<void> {
  if (!session.value) {
    memberStatus.value = null;
    return;
  }
  if (statusRefreshPromise) return statusRefreshPromise;
  statusRefreshPromise = (async () => {
    isStatusLoading.value = true;
    try {
      memberStatus.value = await api.getStatus();
      error.value = null;
    } catch (requestError) {
      error.value = requestError instanceof Error ? requestError.message : 'member_api_error';
    } finally {
      isStatusLoading.value = false;
      statusRefreshPromise = null;
    }
  })();
  return statusRefreshPromise;
}

async function refreshJevConsent(): Promise<void> {
  if (!typesafeJevEnabled || !session.value) {
    jevConsent.value = null;
    return;
  }
  try {
    jevConsent.value = await api.getJevConsent();
  } catch {
    // Consent is fail-closed: an unavailable route never enables Jev.
    jevConsent.value = null;
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

function readManagedTextModel(): AcceptedMemberTextModel {
  try {
    const model = JSON.parse(localStorage.getItem('app-settings') || '{}')?.memberManagedTextModel;
    return normalizeMemberTextModel(model);
  } catch {
    return normalizeMemberTextModel(undefined);
  }
}

export function canUseManagedText(): boolean {
  return Boolean(session.value && memberStatus.value && readManagedTextPreference());
}

export function canUseJev(): boolean {
  return Boolean(
    typesafeJevEnabled &&
    session.value &&
    jevConsent.value?.accepted &&
    memberStatus.value &&
    memberStatus.value.bonusBalance > 0 &&
    readManagedTextPreference()
  );
}

export function hasManagedCredits(required: number): boolean {
  return Boolean(memberStatus.value && memberStatus.value.bonusBalance >= required);
}

export function canUseManagedResearchVerification(): boolean {
  if (!session.value || !memberStatus.value) return false;
  try {
    const capabilities = JSON.parse(localStorage.getItem('app-settings') || '{}')?.capabilities;
    return hasEnabledMGAResearchAgent(capabilities);
  } catch {
    return false;
  }
}

export async function generateManagedText(input: {
  prompt: string;
  idempotencyKey: string;
  operation: 'analysis' | 'generation' | 'regeneration' | 'deep_update' | 'blind_review';
  workflowId?: string;
  model?: AcceptedMemberTextModel;
  sourceText?: string;
  conference?: string;
  blindReviewContext?: import('@/src/services/memberApiClient').MemberBlindReviewContext;
}): Promise<{
  text: string;
  provider?: 'mga' | 'google' | 'openai';
  model?: string;
  modelType?: 'large-language-model' | 'research-agent' | 'image-generation-model';
  jevReview?: JevReviewSummary;
  jevPreflight?: import('@/src/services/memberApiClient').MemberBlindPreflight;
  workflowId: string;
  workflow: {
    analysisCount: number;
    callCount: number;
    generationCount: number;
    deepUpdateCount: number;
  };
}> {
  try {
    const result = await api.generate({
      ...input,
      provider: 'gemini-3.6-flash',
      model: input.model ?? readManagedTextModel(),
    });
    if (memberStatus.value) memberStatus.value.bonusBalance = result.bonusBalance;
    if (result.output.type !== 'text' || !result.output.text) {
      throw new Error('managed_text_response_invalid');
    }
    return {
      text: result.output.text,
      provider: result.output.provider,
      model: result.output.model,
      modelType: result.output.modelType,
      jevReview: result.output.jevReview,
      jevPreflight: result.output.jevPreflight,
      workflowId: result.workflowId,
      workflow: result.workflow,
    };
  } catch (generationError) {
    await refreshStatus();
    throw generationError;
  }
}

export async function generateManagedResearchVerification(input: {
  prompt: string;
  idempotencyKey: string;
  enabledCapabilityIds: string[];
  blindReviewContext?: import('@/src/services/memberApiClient').MemberBlindReviewContext;
}): Promise<{
  text: string;
  provider?: 'mga' | 'google' | 'openai';
  model?: string;
  modelType?: 'large-language-model' | 'research-agent' | 'image-generation-model';
  jevPreflight?: import('@/src/services/memberApiClient').MemberBlindPreflight;
  workflowId: string;
}> {
  try {
    const result = await api.runCapability({
      ...input,
      capabilityId: MGA_RESEARCH_AGENT_ID,
    });
    if (memberStatus.value) memberStatus.value.bonusBalance = result.bonusBalance;
    if (result.output.type !== 'text' || !result.output.text) {
      throw new Error('managed_text_response_invalid');
    }
    return {
      text: result.output.text,
      provider: result.output.provider,
      model: result.output.model,
      modelType: result.output.modelType,
      jevPreflight: result.output.jevPreflight,
      workflowId: result.workflowId,
    };
  } catch (verificationError) {
    await refreshStatus();
    throw verificationError;
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
      supabase.auth.onAuthStateChange((event, nextSession) => {
        session.value = nextSession;
        passwordRecovery.value = event === 'PASSWORD_RECOVERY';
        if (!nextSession) jevConsent.value = null;
        window.setTimeout(() => void refreshStatus(), 0);
        window.setTimeout(() => void refreshJevConsent(), 0);
      });
      const { data } = await supabase.auth.getSession();
      session.value = data.session;
      await refreshStatus();
      await refreshJevConsent();
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
    jevConsent.value = null;
  }

  async function setJevConsent(accepted: boolean) {
    if (!typesafeJevEnabled || !session.value) throw new Error('member_service_unavailable');
    jevConsent.value = await api.setJevConsent(accepted);
    return jevConsent.value;
  }

  async function bootstrap() {
    isLoading.value = true;
    try {
      await api.bootstrap();
      await refreshStatus();
    } finally {
      isLoading.value = false;
    }
  }

  async function checkIn() {
    isLoading.value = true;
    try {
      await api.checkIn();
      await refreshStatus();
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
    model?: AcceptedMemberTextModel | 'gemini-3.1-flash-image' | 'gemini-3-pro-image';
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
    isStatusLoading: computed(() => isStatusLoading.value),
    isAuthenticated: computed(() => Boolean(session.value)),
    passwordRecovery: computed(() => passwordRecovery.value),
    user: computed<User | null>(() => session.value?.user || null),
    status: computed(() => memberStatus.value),
    jevEnabled: computed(() => typesafeJevEnabled),
    jevConsent: computed(() => jevConsent.value),
    error: computed(() => error.value),
    getAccessToken: async () => session.value?.access_token || null,
    initialize,
    refreshStatus,
    refreshJevConsent,
    signInWithGitHub,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    updatePassword,
    updateProfile,
    signOut,
    setJevConsent,
    bootstrap,
    checkIn,
    createCheckout,
    upgradeAbstractQuota,
    managedGenerate,
    memberApi: api,
  };
}
