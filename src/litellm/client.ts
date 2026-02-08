import { getConfig } from '../config.js';

export interface LitellmConfig {
  baseUrl: string;
  masterKey: string;
}

export function getLitellmConfig(): LitellmConfig | null {
  const config = getConfig();
  if (!config.litellmBaseUrl || !config.litellmMasterKey) {
    return null;
  }
  return {
    baseUrl: config.litellmBaseUrl,
    masterKey: config.litellmMasterKey,
  };
}

export async function generateTenantLitellmKey(opts: {
  baseUrl: string;
  masterKey: string;
  tenantId: string;
  slug: string;
  maxBudgetUsd: number;
  models: string[];
}): Promise<string> {
  const url = new URL('/key/generate', opts.baseUrl);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.masterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key_alias: `tenant:${opts.tenantId}`,
      user_id: opts.tenantId,
      max_budget: opts.maxBudgetUsd,
      models: opts.models,
      metadata: {
        tenant_id: opts.tenantId,
        slug: opts.slug,
      },
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new Error(
      `LiteLLM /key/generate failed (${res.status}): ${bodyText || res.statusText}`,
    );
  }

  const data = (await res.json().catch(() => null)) as
    | { key?: unknown }
    | null;
  const key = data && typeof data.key === 'string' ? data.key : null;
  if (!key) throw new Error('LiteLLM /key/generate: missing key in response');
  return key;
}
