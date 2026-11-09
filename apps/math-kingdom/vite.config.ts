import {defineConfig,configDefaults} from 'vitest/config';import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',plugins:[react()],test:{exclude:[...configDefaults.exclude,'release/**']},build:{target:'es2022',chunkSizeWarningLimit:2000,rollupOptions:{output:{manualChunks(id){if(id.includes('/phaser/'))return 'phaser';if(id.includes('/xlsx/'))return 'excel'}}}}});
