<template>
  <div class="space-y-4">
    <div v-if="!configured" class="rounded-lg bg-amber-500/10 p-4 text-sm text-amber-400">
      {{ t('membership.service_unavailable') }}
    </div>

    <template v-else-if="!isAuthenticated">
      <div class="grid grid-cols-3 gap-2" role="tablist" :aria-label="t('membership.account')">
        <button
          v-for="mode in authModes"
          :key="mode.id"
          type="button"
          role="tab"
          :aria-selected="authMode === mode.id"
          class="rounded-md px-3 py-2 text-sm"
          :class="
            authMode === mode.id ? 'bg-brand-primary text-white' : 'bg-base-100 text-text-secondary'
          "
          @click="authMode = mode.id"
        >
          {{ t(mode.label) }}
        </button>
      </div>

      <form class="space-y-3 rounded-lg bg-base-100 p-4" @submit.prevent="submitEmailAuth">
        <JumpingInput
          v-if="authMode === 'register'"
          v-model.trim="nickname"
          :label="t('membership.nickname')"
          autocomplete="nickname"
          maxlength="80"
        />
        <JumpingInput
          v-model.trim="email"
          :label="t('membership.email')"
          type="email"
          autocomplete="email"
          required
        />
        <JumpingInput
          v-if="authMode !== 'reset'"
          v-model="password"
          :label="t('membership.password')"
          type="password"
          :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'"
          minlength="8"
          required
        />
        <button
          type="submit"
          class="w-full rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
          :disabled="isLoading"
        >
          {{ t(`membership.${authMode}_submit`) }}
        </button>
      </form>

      <div class="flex items-center gap-3 text-xs text-text-secondary">
        <span class="h-px flex-1 bg-base-300"></span>{{ t('membership.or')
        }}<span class="h-px flex-1 bg-base-300"></span>
      </div>
      <button
        type="button"
        class="w-full rounded-lg bg-base-100 px-4 py-3 font-semibold text-text-primary hover:bg-base-300"
        @click="run(signInWithGitHub)"
      >
        GitHub OAuth
      </button>
    </template>

    <template v-else>
      <div
        v-if="!status && membershipError"
        class="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100"
        role="alert"
      >
        <span>{{ t('membership.status_unavailable') }}</span>
        <button
          type="button"
          class="shrink-0 rounded-md border border-amber-400/50 px-3 py-1.5 font-semibold hover:bg-amber-400/10"
          :disabled="isStatusLoading"
          @click="run(refreshStatus)"
        >
          {{ isStatusLoading ? t('common.loading') : t('common.retry') }}
        </button>
      </div>

      <section class="rounded-lg bg-base-100 p-4">
        <div class="flex items-center gap-3">
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            alt=""
            referrerpolicy="no-referrer"
            class="h-11 w-11 rounded-full object-cover"
          />
          <div
            v-else
            class="grid h-11 w-11 place-items-center rounded-full bg-brand-primary font-bold text-white"
            aria-hidden="true"
          >
            {{ initial }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold text-text-primary">{{ displayName }}</p>
            <p class="truncate text-xs text-text-secondary">{{ user?.email }}</p>
            <p class="text-xs text-emerald-400">
              {{ t('membership.verified') }} · {{ providerLabel }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-brand-primary">{{ status?.bonusBalance ?? '—' }}</p>
            <p class="text-xs text-text-secondary">{{ t('membership.credit_unit') }}</p>
          </div>
        </div>
      </section>

      <section class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg bg-base-100 p-3">
          <p class="text-xs text-text-secondary">{{ t('membership.checkin_cycle') }}</p>
          <p class="mt-1 font-semibold text-text-primary">
            {{ status ? `${status.checkinCycle}/7` : '—' }}
          </p>
        </div>
        <div class="rounded-lg bg-base-100 p-3">
          <p class="text-xs text-text-secondary">{{ t('membership.cloud_usage') }}</p>
          <p class="mt-1 font-semibold text-text-primary">
            {{ status ? `${status.abstractCount}/${status.abstractQuota}` : '—' }}
          </p>
        </div>
      </section>

      <section v-if="status && !status.checkedInToday" class="space-y-3">
        <button
          type="button"
          :disabled="isLoading"
          class="w-full rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
          @click="dailyCheckIn"
        >
          {{ t('membership.daily_checkin') }}
        </button>
      </section>
      <p v-else-if="status?.checkedInToday" class="text-sm text-emerald-400">
        {{ t('membership.checked_in') }} · {{ status.checkinCycle }}/7
      </p>

      <section class="space-y-3 rounded-lg bg-base-100 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-text-primary">{{ t('membership.cloud_quota') }}</p>
            <p class="text-xs text-text-secondary">{{ t('membership.cloud_quota_help') }}</p>
          </div>
          <div v-if="status" class="flex gap-2">
            <button
              v-if="status.abstractQuota < 100"
              type="button"
              class="rounded-md border border-base-300 px-3 py-1.5 text-xs text-text-primary"
              @click="upgradeQuota(100)"
            >
              100 · 2 {{ t('membership.credit_unit') }}
            </button>
            <button
              v-if="status.abstractQuota < 500"
              type="button"
              class="rounded-md border border-base-300 px-3 py-1.5 text-xs text-text-primary"
              @click="upgradeQuota(500)"
            >
              500 · {{ status.abstractQuota === 100 ? 8 : 10 }}
              {{ t('membership.credit_unit') }}
            </button>
          </div>
        </div>
      </section>

      <details class="rounded-lg bg-base-100 p-4">
        <summary class="cursor-pointer text-sm font-medium text-text-primary">
          {{ t('membership.account_management') }}
        </summary>
        <form class="mt-3 grid gap-3 sm:grid-cols-2" @submit.prevent="saveProfile">
          <JumpingInput
            v-model.trim="profileNickname"
            :label="t('membership.nickname')"
            maxlength="80"
          />
          <JumpingInput v-model.trim="profileEmail" :label="t('membership.email')" type="email" />
          <button class="rounded-md bg-base-300 px-3 py-2 text-sm text-text-primary sm:col-span-2">
            {{ t('membership.save_profile') }}
          </button>
        </form>
        <form
          v-if="isEmailIdentity || passwordRecovery"
          class="mt-4 flex gap-2"
          @submit.prevent="savePassword"
        >
          <JumpingInput
            v-model="newPassword"
            class="min-w-0 flex-1"
            :label="t('membership.new_password')"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
          />
          <button class="rounded-md bg-base-300 px-3 py-2 text-sm text-text-primary">
            {{ t('membership.change_password') }}
          </button>
        </form>
      </details>

      <section class="space-y-2 rounded-lg bg-base-100 p-4">
        <div class="flex gap-2">
          <JumpingInput
            id="recharge-bonus"
            v-model.number="rechargeBonus"
            :label="t('membership.recharge')"
            type="number"
            min="10"
            max="10000"
            step="1"
            class="min-w-0 flex-1"
          />
          <button
            type="button"
            class="rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white"
            @click="run(() => createCheckout(rechargeBonus))"
          >
            {{ t('membership.pay') }}
          </button>
        </div>
        <p class="text-xs text-text-secondary">{{ t('membership.recharge_rate') }}</p>
      </section>

      <button
        type="button"
        class="w-full text-sm text-text-secondary hover:text-text-primary"
        @click="signOut"
      >
        {{ t('membership.sign_out') }}
      </button>
    </template>

    <GitHubRepoLink class="mx-auto text-xs" />
    <p v-if="notice" role="status" class="text-sm text-emerald-400">{{ notice }}</p>
    <p v-if="localError" role="alert" class="text-sm text-red-400">{{ localError }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMembership } from '@/composables/useMembership';
import { localizeError } from '@/lib/i18n/errorMessages';
import JumpingInput from '@/components/ui/JumpingInput.vue';
import GitHubRepoLink from '@/components/ui/GitHubRepoLink.vue';

type AuthMode = 'login' | 'register' | 'reset';
const { t } = useI18n();
const membership = useMembership();
const {
  configured,
  isAuthenticated,
  isLoading,
  isStatusLoading,
  passwordRecovery,
  user,
  status,
  error: membershipError,
  refreshStatus,
  signInWithGitHub,
  signInWithEmail,
  signUpWithEmail,
  requestPasswordReset,
  updatePassword,
  updateProfile,
  signOut,
  checkIn,
  createCheckout,
  upgradeAbstractQuota,
} = membership;

const authMode = ref<AuthMode>('login');
const authModes: Array<{ id: AuthMode; label: string }> = [
  { id: 'login', label: 'membership.login' },
  { id: 'register', label: 'membership.register' },
  { id: 'reset', label: 'membership.forgot_password' },
];
const email = ref('');
const password = ref('');
const nickname = ref('');
const profileNickname = ref('');
const profileEmail = ref('');
const newPassword = ref('');
const rechargeBonus = ref(10);
const localError = ref('');
const notice = ref('');

const displayName = computed(
  () =>
    user.value?.user_metadata?.display_name ||
    user.value?.user_metadata?.name ||
    user.value?.email ||
    ''
);
const avatarUrl = computed(() => user.value?.user_metadata?.avatar_url || '');
const initial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || 'U');
const providerLabel = computed(() => user.value?.app_metadata?.provider || 'email');
const isEmailIdentity = computed(() =>
  Boolean(user.value?.identities?.some((identity) => identity.provider === 'email'))
);

watch(
  user,
  (nextUser) => {
    profileNickname.value =
      nextUser?.user_metadata?.display_name || nextUser?.user_metadata?.name || '';
    profileEmail.value = nextUser?.email || '';
  },
  { immediate: true }
);

const refreshOnFocus = () => {
  if (isAuthenticated.value) void refreshStatus();
};

onMounted(() => {
  refreshOnFocus();
  window.addEventListener('focus', refreshOnFocus);
});

onBeforeUnmount(() => window.removeEventListener('focus', refreshOnFocus));

watch(isAuthenticated, (authenticated) => {
  if (authenticated) void refreshStatus();
});

async function run(action: () => Promise<unknown>) {
  try {
    localError.value = '';
    notice.value = '';
    await action();
  } catch (caught) {
    localError.value = localizeError(caught, t, 'errors.member_action_failed');
  }
}

async function submitEmailAuth() {
  await run(async () => {
    if (authMode.value === 'login') await signInWithEmail(email.value, password.value);
    if (authMode.value === 'register') {
      await signUpWithEmail(email.value, password.value, nickname.value);
      notice.value = t('membership.verification_sent');
    }
    if (authMode.value === 'reset') {
      await requestPasswordReset(email.value);
      notice.value = t('membership.reset_sent');
    }
  });
}

const dailyCheckIn = () =>
  run(async () => {
    await checkIn();
  });

const upgradeQuota = (target: 100 | 500) =>
  run(async () => {
    const current = status.value?.abstractQuota ?? 30;
    const cost = target === 100 ? 2 : current === 100 ? 8 : 10;
    if (!window.confirm(t('membership.confirm_quota_upgrade', { target, cost }))) return;
    await upgradeAbstractQuota(target);
  });

const saveProfile = () =>
  run(async () => {
    await updateProfile({ nickname: profileNickname.value, email: profileEmail.value });
    notice.value = t('membership.profile_saved');
  });

const savePassword = () =>
  run(async () => {
    await updatePassword(newPassword.value);
    newPassword.value = '';
    notice.value = t('membership.password_changed');
  });
</script>
