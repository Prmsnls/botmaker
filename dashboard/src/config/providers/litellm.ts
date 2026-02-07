import type { ProviderConfig } from './types';

export const litellm: ProviderConfig = {
  id: 'litellm',
  label: 'LiteLLM',
  baseUrl: 'http://localhost:4000/v1', // Default LiteLLM proxy URL
  keyHint: 'sk-...',
  defaultModel: 'gpt-5.2',
  models: [
    { id: 'gpt-5.2', label: 'GPT-5.2' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { id: 'deepseek-v3.2', label: 'DeepSeek V3.2' },
    // Add any models your LiteLLM proxy supports
  ],
};
