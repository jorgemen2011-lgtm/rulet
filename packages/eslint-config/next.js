import nextPlugin from '@next/eslint-plugin-next';
import react from './react.js';

/** App web (Next.js). */
export default [
  ...react,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];
