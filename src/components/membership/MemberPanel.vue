<template>
  <Modal :title="t('membership.title')" size="sm" @close="$emit('close')">
    <div v-if="!configured" class="rounded-lg bg-amber-500/10 p-4 text-sm text-amber-500">
      {{ t('membership.service_unavailable') }}
    </div>

    <div v-else-if="!isAuthenticated" class="space-y-4">
      <p class="text-sm text-text-secondary">{{ t('membership.sign_in_help') }}</p>
      <button
        type="button"
        class="w-full rounded-lg bg-base-300 px-4 py-3 font-semibold text-text-primary hover:bg-base-300/80"
        @click="signIn"
      >
        GitHub OAuth
      </button>
      <button
        type="button"
        class="w-full rounded-lg bg-base-300 px-4 py-3 text-text-secondary opacity-60"
        disabled
      >
        {{ t('membership.wechat_coming') }}
      </button>
    </div>

    <div v-else class="space-y-5">
      <div class="flex items-center justify-between rounded-lg bg-base-100 p-4">
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-text-primary">{{ user?.email }}</p>
          <p class="text-xs text-text-secondary">{{ t('membership.online') }}</p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold text-brand-primary">{{ status?.bonusBalance ?? '—' }}</p>
          <p class="text-xs text-text-secondary">bonus</p>
        </div>
      </div>

      <div
        v-if="status && (!status.signupBonusClaimed || !status.checkedInToday)"
        class="space-y-3"
      >
        <TurnstileChallenge
          :key="challengeKey"
          :site-key="turnstileSiteKey"
          @token="turnstileToken = $event"
        />
        <button
          v-if="!status.signupBonusClaimed"
          type="button"
          :disabled="!turnstileToken || isLoading"
          class="w-full rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
          @click="claimSignupBonus"
        >
          {{ t('membership.claim_signup_bonus') }}
        </button>
        <button
          v-else-if="!status.checkedInToday"
          type="button"
          :disabled="!turnstileToken || isLoading"
          class="w-full rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
          @click="dailyCheckIn"
        >
          {{ t('membership.daily_checkin') }}
        </button>
      </div>
      <p v-else-if="status?.checkedInToday" class="text-sm text-emerald-500">
        {{ t('membership.checked_in') }}
      </p>

      <div class="space-y-2 rounded-lg bg-base-100 p-4">
        <label for="recharge-bonus" class="block text-sm font-medium text-text-primary">
          {{ t('membership.recharge') }}
        </label>
        <div class="flex gap-2">
          <input
            id="recharge-bonus"
            v-model.number="rechargeBonus"
            type="number"
            min="10"
            max="10000"
            step="1"
            class="min-w-0 flex-1 rounded-lg border border-base-300 bg-base-200 px-3 py-2"
          />
          <button
            type="button"
            class="rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white"
            @click="recharge"
          >
            {{ t('membership.pay') }}
          </button>
        </div>
        <p class="text-xs text-text-secondary">{{ t('membership.recharge_rate') }}</p>
      </div>

      <p v-if="localError" role="alert" class="text-sm text-red-500">{{ localError }}</p>
      <button
        type="button"
        class="w-full text-sm text-text-secondary hover:text-text-primary"
        @click="signOut"
      >
        {{ t('membership.sign_out') }}
      </button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMembership } from '@/composables/useMembership';
import Modal from '@/components/ui/Modal.vue';
import TurnstileChallenge from './TurnstileChallenge.vue';
import { localizeError } from '@/lib/i18n/errorMessages';

defineEmits<{ close: [] }>();
const { t } = useI18n();
const {
  configured,
  turnstileSiteKey,
  isAuthenticated,
  isLoading,
  user,
  status,
  signInWithGitHub,
  signOut,
  bootstrap,
  checkIn,
  createCheckout,
} = useMembership();
const turnstileToken = ref('');
const challengeKey = ref(0);
const rechargeBonus = ref(10);
const localError = ref('');

async function run(action: () => Promise<void>) {
  try {
    localError.value = '';
    await action();
  } catch (error) {
    localError.value = localizeError(error, t, 'errors.member_action_failed');
  }
}

const signIn = () => run(signInWithGitHub);
const claimSignupBonus = () =>
  run(async () => {
    await bootstrap(turnstileToken.value);
    turnstileToken.value = '';
    challengeKey.value += 1;
  });
const dailyCheckIn = () =>
  run(async () => {
    await checkIn(turnstileToken.value);
    turnstileToken.value = '';
    challengeKey.value += 1;
  });
const recharge = () => run(() => createCheckout(rechargeBonus.value));
</script>
