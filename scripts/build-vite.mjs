#!/usr/bin/env node
/** Bundles the Vite plugin (no runtime deps, types are erased). */
import { build } from 'esbuild'
import { writeFileSync, mkdirSync } from 'node:fs'

const result = await build({
  entryPoints: ['src/vite/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  minify: false,
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
})

const code = result.outputFiles[0].text
mkdirSync('lib', { recursive: true })
writeFileSync('lib/vite.js', code)
console.log(`vite plugin: ${(code.length / 1024).toFixed(1)} KiB`)
