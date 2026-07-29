import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { describe, expect, it } from 'vitest';
import en from '../../../public/locales/en/translation.json';
import WorkflowReentryDialog from './WorkflowReentryDialog.vue';

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

describe('WorkflowReentryDialog', () => {
  it.each([
    ['Re-analyze and generate', 'reanalyze'],
    ['Continue current result', 'continue'],
    ['Cancel', 'cancel'],
  ] as const)('returns the %s choice', async (label, expected) => {
    const wrapper = mount(WorkflowReentryDialog, { global: { plugins: [i18n] } });
    const choice = (
      wrapper.vm as unknown as { open: (operation: 'regeneration') => Promise<string> }
    ).open('regeneration');
    await wrapper.vm.$nextTick();
    const button = wrapper.findAll('button').find((candidate) => candidate.text().includes(label));
    expect(button).toBeTruthy();
    await button!.trigger('click');
    await expect(choice).resolves.toBe(expected);
  });

  it('focuses the recommended action, traps tab, closes on Escape, and restores focus', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const wrapper = mount(WorkflowReentryDialog, {
      attachTo: document.body,
      global: { plugins: [i18n] },
    });
    const choice = (
      wrapper.vm as unknown as { open: (operation: 'regeneration') => Promise<string> }
    ).open('regeneration');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect(document.activeElement?.textContent).toContain('Re-analyze and generate');

    const buttons = wrapper.findAll('button');
    (buttons.at(-1)!.element as HTMLButtonElement).focus();
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement?.textContent).toContain('Re-analyze and generate');

    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    await expect(choice).resolves.toBe('cancel');
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(opener);
    wrapper.unmount();
    opener.remove();
  });
});
