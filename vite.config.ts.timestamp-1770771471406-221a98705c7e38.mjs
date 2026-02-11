// vite.config.ts
import { defineConfig } from "file:///D:/PromptA/node_modules/vite/dist/node/index.js";
import { svelte } from "file:///D:/PromptA/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
var vite_config_default = defineConfig(async () => ({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQcm9tcHRBXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxQcm9tcHRBXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9Qcm9tcHRBL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHsgc3ZlbHRlIH0gZnJvbSAnQHN2ZWx0ZWpzL3ZpdGUtcGx1Z2luLXN2ZWx0ZSdcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyhhc3luYyAoKSA9PiAoe1xyXG4gIHBsdWdpbnM6IFtzdmVsdGUoKV0sXHJcbiAgY2xlYXJTY3JlZW46IGZhbHNlLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgcG9ydDogMTQyMCxcclxuICAgIHN0cmljdFBvcnQ6IHRydWUsXHJcbiAgICB3YXRjaDoge1xyXG4gICAgICBpZ25vcmVkOiBbJyoqL3NyYy10YXVyaS8qKiddXHJcbiAgICB9XHJcbiAgfVxyXG59KSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFvTixTQUFTLG9CQUFvQjtBQUNqUCxTQUFTLGNBQWM7QUFFdkIsSUFBTyxzQkFBUSxhQUFhLGFBQWE7QUFBQSxFQUN2QyxTQUFTLENBQUMsT0FBTyxDQUFDO0FBQUEsRUFDbEIsYUFBYTtBQUFBLEVBQ2IsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osT0FBTztBQUFBLE1BQ0wsU0FBUyxDQUFDLGlCQUFpQjtBQUFBLElBQzdCO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
