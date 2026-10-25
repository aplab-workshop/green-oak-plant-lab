import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const SERVER = process.env.GOL_SERVER_URL ?? 'http://127.0.0.1:3001';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // P50: Demo build — Simulation + Mock PLC ในเบราว์เซอร์, ใช้ได้ใต้ Path ใดก็ได้
  ...(mode === 'demo' ? { base: './', define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') }, build: { outDir: 'dist-demo' } } : {}),
  server: {
    port: 5173,
    // Browser คุยกับ Server ผ่าน Vite proxy เท่านั้น (ไม่ต่อ PLC โดยตรง — FR-35)
    proxy: {
      '/api': SERVER,
      '/ws': { target: SERVER.replace(/^http/, 'ws'), ws: true },
    },
  },
}));
