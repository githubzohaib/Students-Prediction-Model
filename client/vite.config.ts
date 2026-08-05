import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // jsPDF is only needed on the export path; splitting it keeps the
    // initial bundle small.
    rollupOptions: {
      output: {
        manualChunks: {
          pdf: ["jspdf", "jspdf-autotable"],
        },
      },
    },
  },
})