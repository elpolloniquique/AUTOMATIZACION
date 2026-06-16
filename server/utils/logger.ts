import { getSupabaseAdmin } from '../utils/supabase.js';

export async function createPostLog(params: {
  postId: string;
  platform: string;
  action: string;
  status: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('post_logs').insert({
    post_id: params.postId,
    platform: params.platform,
    action: params.action,
    status: params.status,
    request_payload: params.requestPayload ?? null,
    response_payload: params.responsePayload ?? null,
    error_message: params.errorMessage ?? null,
  });
  if (error) console.error('[post_log]', error.message);
}

export function sanitizeForLog(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const sanitized = { ...(payload as Record<string, unknown>) };
  const sensitiveKeys = ['access_token', 'refresh_token', 'token', 'password', 'secret'];
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}
