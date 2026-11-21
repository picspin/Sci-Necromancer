// Development-only contract harness: synthetic identity/transport, actual local renderer.
import { computed, createApp, h, onBeforeUnmount, ref } from 'vue';
import { useMemberFigureTask } from '../../../src/composables/useMemberFigureTask';
import { createMemberApiClient } from '../../../src/services/memberApiClient';
import { BrowserFigureSession, createFigureSpec } from '../../../src/services/browserFigures';
if (!import.meta.env.DEV) throw new Error('Development-only harness');

createApp({
  setup() {
    const id = '11111111-1111-4111-8111-111111111111';
    const supplierCalls = ref(0),
      debits = ref(0),
      renders = ref(0),
      preparing = ref(false),
      confirmed = ref(false),
      error = ref('');
    const requests = ref<string[]>([]);
    const bytes = new TextEncoder().encode('Category,Value\nTreatment,12\nControl,9\n');
    const session = new BrowserFigureSession();
    let datasetHash = '',
      specHash: string | null = null,
      receiptHash: string | null = null,
      status = 'reserved',
      plan: Record<string, unknown> | undefined,
      key = '',
      lost = false;
    const api = createMemberApiClient({
      baseUrl: 'https://synthetic.invalid',
      getAccessToken: async () => 'synthetic-not-session',
      fetcher: async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        requests.value.push(request.operation);
        let result: unknown;
        if (request.operation === 'plan') {
          const cached = Boolean(plan);
          const nextKey = (init?.headers as Record<string, string>)['Idempotency-Key'];
          if (key && key !== nextKey) throw new Error('A new task key was created');
          key = nextKey;
          if (!plan) {
            ++supplierCalls.value;
            datasetHash = request.datasetHash;
            const spec = createFigureSpec(
              datasetHash,
              'grouped-bar',
              { category: 'col_1', value: 'col_2' },
              { value: 'score' },
              'nature'
            );
            const canonical = JSON.stringify(spec, (_key, v) =>
              v && typeof v === 'object' && !Array.isArray(v)
                ? Object.fromEntries(
                    Object.keys(v)
                      .sort()
                      .map((k) => [k, v[k]])
                  )
                : v
            );
            specHash = Array.from(
              new Uint8Array(
                await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
              ),
              (b) => b.toString(16).padStart(2, '0')
            ).join('');
            status = 'awaiting_render';
            plan = {
              kind: 'draft',
              versionId: id,
              spec,
              status,
              provider: 'mga',
              actualModel: 'synthetic-upstream-model',
              requestedModel: 'deepseek-v4.1-flash',
            };
          }
          result = { ...plan, cached };
        } else {
          if (request.versionId !== id) throw new Error('Wrong version');
          if (request.operation === 'complete') {
            if (request.specHash !== specHash) throw new Error('Wrong frozen-spec hash');
            if (status !== 'completed') ++debits.value;
            status = 'completed';
            receiptHash = request.receiptHash;
            if (!lost) {
              lost = true;
              throw new TypeError('Synthetic response lost after commit');
            }
          }
          if (request.operation === 'cancel' && status !== 'completed') status = 'cancelled';
          if (request.operation === 'fail' && status !== 'completed') status = 'failed';
          result = {
            version: {
              id,
              parentId: null,
              status,
              requestedModel: 'deepseek-v4.1-flash',
              actualProvider: 'mga',
              actualModel: 'synthetic-upstream-model',
              datasetHash,
              specHash,
              receiptHash,
            },
            wallet: {
              bonusBalance: status === 'completed' ? 0 : 1,
              heldBonus: status === 'awaiting_render' ? 1 : 0,
              availableBonus: ['completed', 'awaiting_render'].includes(status) ? 0 : 1,
            },
          };
        }
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    const task = useMemberFigureTask(api, {
      owner: () => 'synthetic-member',
      canStart: () => debits.value === 0,
      render: async (spec, signal) => {
        ++renders.value;
        const cancel = () => session.dispose();
        signal.addEventListener('abort', cancel, { once: true });
        try {
          return await session.render(bytes, spec);
        } finally {
          signal.removeEventListener('abort', cancel);
        }
      },
    });
    const state = computed(() => task.state.value);
    async function start() {
      if (preparing.value || task.locked.value || debits.value) return;
      preparing.value = true;
      confirmed.value = false;
      try {
        const profile = await session.inspect(bytes);
        await task.start({
          datasetHash: profile.dataset_sha256,
          model: 'deepseek-v4.1-flash',
          input: {
            templateId: 'grouped-bar',
            styleId: 'nature',
            goal: 'Compare supplied groups',
            fields: [
              { id: 'col_1', alias: 'group', type: 'categorical' },
              { id: 'col_2', alias: 'value', type: 'continuous', unit: 'score' },
            ],
          },
        });
      } catch {
        error.value = 'Local runtime unavailable';
      } finally {
        preparing.value = false;
      }
    }
    onBeforeUnmount(() => {
      task.reset();
      session.dispose();
    });
    return () =>
      h('main', [
        h('h1', 'Synthetic member task verification'),
        h(
          'p',
          'Development only: no real member, Jev, MGA or wallet calls. Fixed pre-approved metadata, mock server settlement and actual browser Python rendering.'
        ),
        h(
          'button',
          { disabled: preparing.value || task.locked.value || debits.value > 0, onClick: start },
          'Start confirmed task'
        ),
        h('label', [
          h('input', {
            type: 'checkbox',
            checked: confirmed.value,
            disabled: state.value.phase !== 'draft',
            onChange: (e: Event) => {
              confirmed.value = (e.target as HTMLInputElement).checked;
            },
          }),
          'Confirm frozen spec',
        ]),
        h(
          'button',
          {
            disabled: !confirmed.value || state.value.phase !== 'draft' || task.busy.value,
            onClick: task.confirm,
          },
          'Render and settle'
        ),
        h(
          'button',
          {
            disabled: !['unknown', 'pending'].includes(state.value.phase) || task.busy.value,
            onClick: task.recover,
          },
          'Recover original task'
        ),
        h('p', { role: 'status', 'aria-label': 'Task phase' }, state.value.phase),
        h('p', { role: 'alert' }, error.value || state.value.error || ''),
        h(
          'pre',
          { 'aria-label': 'Contract evidence' },
          JSON.stringify(
            {
              requests: requests.value,
              supplierCalls: supplierCalls.value,
              renders: renders.value,
              debits: debits.value,
              busy: task.busy.value,
              locked: task.locked.value,
            },
            null,
            2
          )
        ),
        state.value.spec ? h('pre', JSON.stringify(state.value.spec, null, 2)) : null,
        state.value.preview
          ? h('figure', [
              h('img', {
                alt: 'Synthetic task preview',
                src: `data:image/png;base64,${state.value.preview.preview}`,
              }),
              h(
                'figcaption',
                `${state.value.preview.manifest.width_px} × ${state.value.preview.manifest.height_px} · ${state.value.preview.manifest.dpi} DPI`
              ),
            ])
          : null,
      ]);
  },
}).mount('#app');
