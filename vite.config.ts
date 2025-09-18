import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // dev에서는 '/', build(배포)에서는 './' 로 산출물 경로 고정
  base: command === 'build' ? './' : '/',
}))
