import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // The CSP allows same-origin assets only, so never inline assets as data: URIs.
  build: { assetsInlineLimit: 0 },
});
