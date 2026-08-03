import { afterEach, describe, expect, it, vi } from 'vitest';
import { callManagedProvider, callMGAResearchAgent } from './providers';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function enableMGA() {
  vi.stubEnv('MGA_BASE_URL', 'https://mga.example.com/api/v2');
  vi.stubEnv('MGA_API_KEY', 'mga-test-key');
}

describe('managed MGA capability routing', () => {
  it('runs the research verification agent with only the approved read-only tools', async () => {
    enableMGA();
    const assessment = {
      recommendation: 'minor-revision',
      summary: 'One citation needs verification.',
      findings: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(assessment) } }] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callMGAResearchAgent({
        prompt: 'Verify this abstract without inventing evidence.',
        enabledCapabilityIds: ['mga-pubmed', 'mga-semantic-scholar'],
      })
    ).resolves.toEqual({ type: 'text', text: JSON.stringify(assessment) });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mga.example.com/api/v2/chat/agent',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({
      model: 'glm-5',
      stream: false,
      tool_keys: ['pubmed_data_source', 'semantic_scholar'],
      hidden: true,
    });
    expect(body.messages[0].content).toContain('read-only research verification');
    expect(JSON.stringify(body)).not.toContain('websearch');
  });

  it('uses GLM-5.2 through the MGA v2 chat completion contract', async () => {
    enableMGA();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '  revised abstract  ' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({
        provider: 'gemini-3.6-flash',
        prompt: 'Polish this abstract',
        reasoning: 'high',
      })
    ).resolves.toEqual({ type: 'text', text: 'revised abstract' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mga.example.com/api/v2/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer mga-test-key' })
    );
    expect(request.headers).not.toHaveProperty('x-baychatgpt-accesstoken');
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: 'glm-5.2',
      reasoning_effort: 'high',
      stream: false,
    });
  });

  it('routes Nano Banana membership generation to Imagen 4 via img_generator', async () => {
    enableMGA();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '',
                images: [{ image_url: { url: 'data:image/png;base64,aW1hZ2U=' } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a flowchart' })
    ).resolves.toEqual({ type: 'image', base64: 'aW1hZ2U=', mimeType: 'image/png' });

    expect(fetchMock.mock.calls[0][0]).toBe('https://mga.example.com/api/v2/chat/agent');
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({
      model: 'glm-5.2',
      stream: false,
      tool_keys: ['img_generator'],
      hidden: true,
    });
    expect(body.messages[0].content).toContain('imagen-4');
  });

  it('routes the GPT Image membership option to GPT-Image-1 and accepts file events', async () => {
    enableMGA();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '' } }],
          metadata: [
            {
              event: {
                event_type: 'files',
                files: [{ filename: 'generated.png', content: 'aW1hZ2U=' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({ provider: 'gpt-image-2', prompt: 'Generate a clinical figure' })
    ).resolves.toEqual({ type: 'image', base64: 'aW1hZ2U=', mimeType: 'image/png' });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.messages[0].content).toContain('gpt-image-1');
  });

  it('downloads an MGA signed image only from the configured HTTPS image host', async () => {
    enableMGA();
    const signedUrl =
      'https://mygenassist-prod-generated-documents.s3.eu-central-1.amazonaws.com/generated.png?signature=test';
    const imageResponse = new Response(Uint8Array.from([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Content-Length': '3' },
    });
    Object.defineProperty(imageResponse, 'url', { value: signedUrl });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Image generated.' } }],
            metadata: [
              {
                action: {
                  status: 'end',
                  tool_key: 'img_generator',
                  data: { output: `Images were generated successfully.\n\n![Img 1](${signedUrl})` },
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(imageResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate an image' })
    ).resolves.toEqual({ type: 'image', base64: 'AQID', mimeType: 'image/png' });

    expect(fetchMock.mock.calls[1][0]).toEqual(new URL(signedUrl));
    expect(fetchMock.mock.calls[1][1]).not.toHaveProperty('headers');
  });

  it('fails closed when only half of the MGA configuration is present', async () => {
    vi.stubEnv('MGA_BASE_URL', 'https://mga.example.com/api/v2');
    vi.stubEnv('MGA_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({ provider: 'gemini-3.6-flash', prompt: 'test' })
    ).rejects.toMatchObject({ code: 'managed_provider_unavailable', status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects MGA base URLs that are not fixed HTTPS v2/v3 endpoints', async () => {
    vi.stubEnv('MGA_BASE_URL', 'http://127.0.0.1:4000');
    vi.stubEnv('MGA_API_KEY', 'mga-test-key');
    vi.stubGlobal('fetch', vi.fn());

    await expect(
      callManagedProvider({ provider: 'gemini-3.6-flash', prompt: 'test' })
    ).rejects.toMatchObject({ code: 'managed_provider_unavailable', status: 503 });
  });
});
