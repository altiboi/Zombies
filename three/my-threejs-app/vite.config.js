import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/~sgijima/",  // Set base path for all assets
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        level1: resolve(__dirname, "level1.html"),
        game: resolve(__dirname, "game.html"),
        level2: resolve(__dirname, "level2.html"),
        level3: resolve(__dirname, "level3.html"),
        gameover: resolve(__dirname, "gameover.html"),
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
