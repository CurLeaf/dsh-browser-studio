#!/usr/bin/env node
/** Bundles the client half and wraps it in the DSH module-loader envelope. */
import { build } from 'esbuild'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

const result = await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  external: ['react'],
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
})

const code = result.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${code}
    return module.exports;
  },
});
`
mkdirSync('lib', { recursive: true })
writeFileSync('lib/client.js', wrapped)
console.log(`client bundle: ${(wrapped.length / 1024).toFixed(1)} KiB`)
