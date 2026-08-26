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
  vi.stubEnv('GOOGLE_API_KEY', '');
  vi.stubEnv('GEMINI_API_KEY', '');
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
    ).resolves.toEqual({
      type: 'text',
      text: JSON.stringify(assessment),
      provider: 'mga',
      model: 'glm-5',
      modelType: 'research-agent',
    });

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
    ).resolves.toEqual({
      type: 'text',
      text: 'revised abstract',
      provider: 'mga',
      model: 'glm-5.2',
      modelType: 'large-language-model',
    });

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
      response_format: { type: 'json_object' },
    });
    expect(JSON.parse(String(request.body)).messages[0]).toMatchObject({ role: 'system' });
  });

  it('routes the premium member text option to GPT-5.6 Luna', async () => {
    enableMGA();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'luna result' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({
        provider: 'gemini-3.6-flash',
        model: 'gpt-5.6-luna',
        prompt: 'Polish this abstract',
      })
    ).resolves.toMatchObject({
      type: 'text',
      text: 'luna result',
      provider: 'mga',
      model: 'gpt-5.6-luna',
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.model).toBe('gpt-5.6-luna');
  });

  it('routes managed Nano Banana Flash through the MGA v2 chat-completion image contract', async () => {
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
    ).resolves.toEqual({
      type: 'image',
      base64: 'aW1hZ2U=',
      mimeType: 'image/png',
      provider: 'mga',
      model: 'gemini-3.1-flash-image',
      requestedModel: 'gemini-3.1-flash-image',
      fallbackPath: ['gemini-3.1-flash-image'],
      modelType: 'image-generation-model',
    });

    expect(fetchMock.mock.calls[0][0]).toBe('https://mga.example.com/api/v2/chat/completions');
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({
      model: 'gemini-3.1-flash-image',
      stream: false,
    });
    expect(body.messages[0]).toMatchObject({ role: 'user' });
  });

  it('uses Gemini 3 Pro Image for member editing with the reference image', async () => {
    enableMGA();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [
                  { type: 'image_url', image_url: { url: 'data:image/webp;base64,ZWRpdA==' } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({
        provider: 'nano-banana-pro',
        model: 'gemini-3-pro-image',
        prompt: 'Edit this image',
        images: [{ data: 'aW1hZ2U=', mimeType: 'image/png' }],
      })
    ).resolves.toMatchObject({
      type: 'image',
      base64: 'ZWRpdA==',
      mimeType: 'image/webp',
      model: 'gemini-3-pro-image',
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.messages[0].content).toContainEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
    });
  });

  it('falls back to the sibling Gemini model for editing and reports the actual model path', async () => {
    enableMGA();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: 'There are no healthy deployments for this model' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  images: [{ image_url: { url: 'data:image/webp;base64,ZWRpdA==' } }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({
        provider: 'nano-banana-pro',
        model: 'gemini-3-pro-image',
        prompt: 'Edit this image',
        images: [{ data: 'aW1hZ2U=', mimeType: 'image/png' }],
      })
    ).resolves.toMatchObject({
      type: 'image',
      base64: 'ZWRpdA==',
      mimeType: 'image/webp',
      model: 'gemini-3.1-flash-image',
      requestedModel: 'gemini-3-pro-image',
      fallbackPath: ['gemini-3-pro-image', 'gemini-3.1-flash-image'],
    });

    const secondBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(secondBody.model).toBe('gemini-3.1-flash-image');
    expect(secondBody.messages[0].content).toContainEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
    });
  });

  it('treats a transient Gemini transport failure as fallback-eligible', async () => {
    enableMGA();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
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
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
    ).resolves.toMatchObject({
      model: 'gemini-3-pro-image',
      fallbackPath: ['gemini-3.1-flash-image', 'gemini-3-pro-image'],
    });
  });

  it('treats an MGA 200 response without image data as fallback-eligible', async () => {
    enableMGA();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'Image queued.' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
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
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
    ).resolves.toMatchObject({
      provider: 'mga',
      model: 'gemini-3-pro-image',
      fallbackPath: ['gemini-3.1-flash-image', 'gemini-3-pro-image'],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back when an MGA signed image cannot be downloaded', async () => {
    enableMGA();
    const signedUrl =
      'https://mygenassist-prod-generated-documents.s3.eu-central-1.amazonaws.com/generated.png?signature=test';
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
                  data: { output: `![generated](${signedUrl})` },
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
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
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
    ).resolves.toMatchObject({
      provider: 'mga',
      model: 'gemini-3-pro-image',
      fallbackPath: ['gemini-3.1-flash-image', 'gemini-3-pro-image'],
    });
    expect(fetchMock.mock.calls[1][0]).toEqual(new URL(signedUrl));
  });

  it('falls back from empty MGA image responses to Google Flash and preserves edit input', async () => {
    enableMGA();
    vi.stubEnv('GOOGLE_API_KEY', 'google-test-key');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { mimeType: 'image/webp', data: 'ZWRpdA==' } }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({
        provider: 'nano-banana-pro',
        model: 'gemini-3-pro-image',
        prompt: 'Edit this image',
        images: [{ data: 'aW1hZ2U=', mimeType: 'image/png' }],
        size: '1536x1024',
      })
    ).resolves.toEqual({
      type: 'image',
      base64: 'ZWRpdA==',
      mimeType: 'image/webp',
      provider: 'google',
      model: 'gemini-3.1-flash-image',
      requestedModel: 'gemini-3-pro-image',
      fallbackPath: [
        'gemini-3-pro-image',
        'gemini-3.1-flash-image',
        'google/gemini-3.1-flash-image',
      ],
      modelType: 'image-generation-model',
    });

    expect(fetchMock.mock.calls[2][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent'
    );
    const googleRequest = fetchMock.mock.calls[2][1] as RequestInit;
    expect(googleRequest.headers).toEqual(
      expect.objectContaining({ 'x-goog-api-key': 'google-test-key' })
    );
    const googleBody = JSON.parse(String(googleRequest.body));
    expect(googleBody.contents[0].parts).toContainEqual({
      inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' },
    });
    expect(googleBody.generationConfig).toEqual({
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '3:2' },
    });
  });

  it('uses Google Pro when the Google Flash fallback is transiently unavailable', async () => {
    enableMGA();
    vi.stubEnv('GOOGLE_API_KEY', 'google-test-key');
    const unavailable = (status = 503) =>
      new Response(JSON.stringify({ error: { message: 'temporarily unavailable' } }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unavailable())
      .mockResolvedValueOnce(unavailable())
      .mockResolvedValueOnce(unavailable(404))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { mimeType: 'image/png', data: 'cHJv' } }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
    ).resolves.toMatchObject({
      provider: 'google',
      model: 'gemini-3-pro-image',
      fallbackPath: [
        'gemini-3.1-flash-image',
        'gemini-3-pro-image',
        'google/gemini-3.1-flash-image',
        'google/gemini-3-pro-image',
      ],
    });
    expect(fetchMock.mock.calls[3][0]).toContain('/gemini-3-pro-image:generateContent');
  });

  it('does not hide a Google credential failure behind another fallback', async () => {
    enableMGA();
    vi.stubEnv('GOOGLE_API_KEY', 'invalid-google-key');
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const mgaUnavailable = () =>
      new Response(JSON.stringify({ error: { message: 'temporarily unavailable' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mgaUnavailable())
      .mockResolvedValueOnce(mgaUnavailable())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'invalid credential' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
    ).rejects.toMatchObject({ code: 'managed_provider_failed' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const events = logSpy.mock.calls.map(([event]) => JSON.parse(String(event)));
    expect(events).toContainEqual(
      expect.objectContaining({
        provider: 'google',
        model: 'gemini-3.1-flash-image',
        outcome: 'rejected',
        status: 403,
      })
    );
  });

  it('falls back to Google Flash when MGA returns a generic upstream 400', async () => {
    enableMGA();
    vi.stubEnv('GOOGLE_API_KEY', 'google-test-key');
    const upstreamBadRequest = () =>
      new Response(JSON.stringify({ detail: 'Image generation request failed upstream' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(upstreamBadRequest())
      .mockResolvedValueOnce(upstreamBadRequest())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
    ).resolves.toMatchObject({
      provider: 'google',
      model: 'gemini-3.1-flash-image',
      fallbackPath: [
        'gemini-3.1-flash-image',
        'gemini-3-pro-image',
        'google/gemini-3.1-flash-image',
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not fallback when Gemini rejects the request for safety reasons', async () => {
    enableMGA();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Request blocked by safety policy' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Unsafe request' })
    ).rejects.toMatchObject({ code: 'managed_provider_failed' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fallback when MGA reports an authentication failure as HTTP 400', async () => {
    enableMGA();
    vi.stubEnv('GOOGLE_API_KEY', 'google-test-key');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'The supplied credential is not valid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
    ).rejects.toMatchObject({ code: 'managed_provider_failed' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Imagen 4 only when direct Nano Banana generation is unavailable', async () => {
    enableMGA();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: 'There are no healthy deployments for this model' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: 'There are no healthy deployments for this model' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
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
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
    ).resolves.toMatchObject({
      type: 'image',
      base64: 'aW1hZ2U=',
      model: 'imagen-4',
      requestedModel: 'gemini-3.1-flash-image',
      fallbackPath: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'imagen-4'],
    });

    expect(fetchMock.mock.calls[1][0]).toBe('https://mga.example.com/api/v2/chat/completions');
    expect(fetchMock.mock.calls[2][0]).toBe('https://mga.example.com/api/v2/chat/agent');
  });

  it('uses Google directly when MGA is not configured', async () => {
    vi.stubEnv('MGA_BASE_URL', '');
    vi.stubEnv('MGA_API_KEY', '');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    vi.stubEnv('GOOGLE_API_KEY', 'google-test-key');
    await expect(
      callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' })
    ).resolves.toMatchObject({
      provider: 'google',
      model: 'gemini-3.1-flash-image',
      fallbackPath: ['google/gemini-3.1-flash-image'],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('accepts GEMINI_API_KEY as a legacy alias for direct Google fallback', async () => {
    vi.stubEnv('MGA_BASE_URL', '');
    vi.stubEnv('MGA_API_KEY', '');
    vi.stubEnv('GOOGLE_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'legacy-google-key');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await callManagedProvider({ provider: 'nano-banana-pro', prompt: 'Generate a figure' });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ 'x-goog-api-key': 'legacy-google-key' }),
    });
  });

  it('routes GPT Image editing to GPT-Image-1 with the reference image input', async () => {
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
      callManagedProvider({
        provider: 'gpt-image-2',
        prompt: 'Edit a clinical figure',
        images: [{ data: 'aW1hZ2U=', mimeType: 'image/png' }],
      })
    ).resolves.toMatchObject({
      type: 'image',
      base64: 'aW1hZ2U=',
      mimeType: 'image/png',
      provider: 'mga',
      model: 'gpt-image-1',
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.messages[0].content).toContain('gpt-image-1');
    expect(body.messages[1].content).toContainEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
    });
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
    ).resolves.toMatchObject({
      type: 'image',
      base64: 'AQID',
      mimeType: 'image/png',
      provider: 'mga',
      model: 'gemini-3.1-flash-image',
    });

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
