import type { ProviderConfig } from './types';

export const litellm: ProviderConfig = {
  id: 'openputer',
  label: 'OpenPuter',
  baseUrl: '',
  defaultModel: 'openputer-auto',
  models: [
    { id: 'openputer-auto', label: 'Openputer Auto' },
  ],
};
