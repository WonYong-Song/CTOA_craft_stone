import { defineConfig } from 'vite';

// GitHub Pages 하위 경로에서도 동작하도록 상대 base 사용
export default defineConfig({
  base: './',
  build: {
    base: "CTOA_make_stone",
    plugins: [react()],
    emptyOutDir: true
  },
});


