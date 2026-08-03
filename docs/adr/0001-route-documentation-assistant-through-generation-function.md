# Route the documentation assistant through the existing generation function

The public `POST /api/help` endpoint is rewritten to the existing generation Serverless Function and dispatched to an isolated documentation-assistant handler. This preserves a clear public API without consuming another Vercel Hobby function slot, while keeping help validation, rate limits, prompts, responses, and billing separate from scientific generation tasks.
