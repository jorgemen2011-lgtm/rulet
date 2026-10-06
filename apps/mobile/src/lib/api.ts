import { createApiClient } from '@rulet/api-client';

export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  platform: 'mobile',
});
