import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // In many environments (like AI Studio), the key is provided as API_KEY.
    // The local setup in README uses GEMINI_API_KEY. This supports both.
    const apiKey = env.API_KEY || env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('⚠️ Gemini API key not found. Please set API_KEY or GEMINI_API_KEY in your environment or .env file.');
    }

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // The application code uses process.env.API_KEY to instantiate the Gemini client.
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey) // Keep for compatibility
      },
      resolve: {
        alias: {
          // Fix: Replaced `__dirname` with `path.resolve('./')` to fix "Cannot find name '__dirname'". `__dirname` is not available in ES Modules.
          // Also avoided process.cwd() to prevent TypeScript errors.
          '@': path.resolve('./'),
        },
      },
    };
});