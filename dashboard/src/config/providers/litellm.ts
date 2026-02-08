import type { ProviderConfig } from './types';

export const litellm: ProviderConfig = {
  id: 'litellm',
  label: 'LiteLLM',
  baseUrl: '',
  defaultModel: 'openputer-auto',
  models: [
    { id: 'openputer-auto', label: 'Openputer Auto' },
  ],
};
