import type { IncomingMessage, ServerResponse } from 'node:http';

export interface VercelRequest extends IncomingMessage {
  body: any;
  cookies: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
}

export interface VercelResponse extends ServerResponse {
  json(body: unknown): VercelResponse;
  redirect(statusOrUrl: number | string, url?: string): VercelResponse;
  send(body: unknown): VercelResponse;
  status(statusCode: number): VercelResponse;
}
