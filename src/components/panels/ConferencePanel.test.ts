import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import ConferencePanel from './ConferencePanel.vue';

vi.mock('./ISMRMPanel.vue', () => ({ default: { template: '<div />' } }));
vi.mock('./RSNAPanel.vue', () => ({ default: { template: '<div />' } }));
vi.mock('./ERPanel.vue', () => ({ default: { template: '<div />' } }));
vi.mock('./ESCPanel.vue', () => ({ default: { template: '<div />' } }));
vi.mock('./ImageGenerationPanel', () => ({ ImageGenerationPanel: { template: '<div />' } }));
vi.mock('./OncologyConferencePanel.vue', () => ({
  default: {
    props: ['conference'],
    template: '<div data-test="oncology-panel">{{ conference }}</div>',
  },
}));

const switchConference = vi.hoisted(() => vi.fn());

vi.mock('@/composables/useConferenceRegistry', () => ({
  useConferenceRegistry: () => ({
    initialized: ref(true),
    activeConference: ref('ISMRM'),
    conferenceInfo: ref(
      ['ISMRM', 'RSNA', 'ER', 'ESC', 'ASCO', 'ESMO'].map((id) => ({
        id,
        name: id,
        submissionUrl: '#',
        available: true,
        colorScheme: { primary: '#123456', secondary: '#234567', accent: '#345678' },
      }))
    ),
    switchConference,
  }),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('ConferencePanel navigation', () => {
  it('keeps every existing slice and routes ASCO/ESMO through the shared oncology panel', async () => {
    const wrapper = mount(ConferencePanel, {
      global: {
        stubs: {
          ISMRMPanel: true,
          RSNAPanel: true,
          ERPanel: true,
          ESCPanel: true,
          ImageGenerationPanel: true,
          OncologyConferencePanel: {
            props: ['conference'],
            template: '<div data-test="oncology-panel">{{ conference }}</div>',
          },
        },
      },
    });

    for (const label of ['ISMRM', 'RSNA', 'ER', 'ESC', 'ASCO', 'ESMO', 'IMAGE']) {
      expect(wrapper.findAll('button').some((button) => button.text().includes(label))).toBe(true);
    }

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('ASCO'))!
      .trigger('click');
    expect(wrapper.get('[data-test="oncology-panel"]').text()).toBe('ASCO');

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('ESMO'))!
      .trigger('click');
    expect(wrapper.get('[data-test="oncology-panel"]').text()).toBe('ESMO');
  });
});
