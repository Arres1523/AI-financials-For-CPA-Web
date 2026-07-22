import { Resend } from "resend";

let _client: Resend | null = null;

export function getResend(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not configured");
  }
  _client = new Resend(apiKey);
  return _client;
}
