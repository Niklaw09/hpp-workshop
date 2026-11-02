import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain Vite + React setup. Runs unchanged in Bolt.new (WebContainers): no native binaries.
export default defineConfig({
  plugins: [react()],
  server: { host: true },
});
