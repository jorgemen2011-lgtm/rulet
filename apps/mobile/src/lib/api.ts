import { createApiClient } from '@rulet/api-client';
import { env } from './env';

export const api = createApiClient({ baseUrl: env.EXPO_PUBLIC_API_URL, platform: 'mobile' });
