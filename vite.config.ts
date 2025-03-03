import { defineConfig } from 'vite'
import * as path from "path";
import dts from "vite-plugin-dts";

// https://www.matijanovosel.com/blog/making-and-publishing-components-with-vue-3-and-vite
export default defineConfig({
  plugins: [dts()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "cloud-ts",
      fileName: "cloud-ts",
    }
  }
});