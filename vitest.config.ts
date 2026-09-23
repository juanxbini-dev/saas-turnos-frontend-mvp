import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    // Huso fijo para TODA la suite. El bug de corrimiento ISO-UTC (new Date('2026-08-01')
    // mostrando el día 31/07) solo se ve con huso negativo: en un CI en UTC los tests de
    // fechas pasarían siempre y quedarían decorativos. El testigo que confirma que el huso
    // quedó fijado de verdad está en src/tests/huso.testigo.test.ts.
    env: {
      TZ: 'America/Argentina/Buenos_Aires',
    },
  },
});
