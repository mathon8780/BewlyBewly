import { defineConfig, transformWithEsbuild } from 'vite'

import { isDev, isFirefox, isSafari, r } from './scripts/utils'
import { bootstrapContentScript } from './src/contentScripts'
import { supportsContentScript } from './src/contentScripts/pageScope'
import { sharedConfig } from './vite.config'

// bundling the content script using Vite
export default defineConfig({
  ...sharedConfig,
  base: './',
  plugins: [
    ...sharedConfig.plugins!,
    {
      name: 'extension-content-bootstrap',
      enforce: 'post',
      async generateBundle(_options, bundle) {
        const css = new Set<string>()
        const visited = new Set<string>()
        const collect = (fileName: string) => {
          if (visited.has(fileName))
            return
          visited.add(fileName)
          const chunk = bundle[fileName]
          if (!chunk || chunk.type !== 'chunk') {
            return
          }
          const metadata = (chunk as typeof chunk & { viteMetadata?: { importedCss: Set<string> } }).viteMetadata
          metadata?.importedCss.forEach(file => css.add(file))
          chunk.imports.forEach(collect)
        }
        collect('runtime.js')
        const code = `(() => {
          if (!(${supportsContentScript.toString()})(location.href, window.self !== window.top)) return;
          const runtime = globalThis.browser || globalThis.chrome;
          const url = path => runtime.runtime.getURL('dist/contentScripts/' + path);
          (${bootstrapContentScript.toString()})(url('runtime.js'), ${JSON.stringify([...css])}.map(url)).catch(console.error);
        })();`
        const result = await transformWithEsbuild(code, 'bootstrap.js', { minify: !isDev })
        this.emitFile({ type: 'asset', fileName: 'index.global.js', source: result.code })
      },
    },
  ],
  build: {
    watch: isDev
      ? { include: ['./**/*'] }
      : undefined,
    outDir: r(isFirefox ? 'extension-firefox/dist/contentScripts' : isSafari ? 'extension-safari/dist/contentScripts' : 'extension/dist/contentScripts'),
    cssCodeSplit: true,
    emptyOutDir: false,
    sourcemap: false, // https://github.com/vitejs/vite-plugin-vue/issues/35
    rollupOptions: {
      input: r('src/contentScripts/runtime.ts'),
      preserveEntrySignatures: 'strict',
      output: {
        format: 'es',
        entryFileNames: 'runtime.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'styles/[name]-[hash][extname]',
      },
    },
  },
})
