<template>
  <Modal :title="t('membership.title')" size="sm" @close="$emit('close')">
    <MemberAccount />
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import MemberAccount from './MemberAccount.vue';

defineEmits<{ close: [] }>();
const { t } = useI18n();
</script>
