import * as esbuild from 'esbuild'

const ESM_REQUIRE_SHIM = `
await (async () => {
  const { dirname } = await import("path");
  const { fileURLToPath } = await import("url");
  
  if (typeof globalThis.__filename === "undefined") {
    globalThis.__filename = fileURLToPath(import.meta.url);
  }
  if (typeof globalThis.__dirname === "undefined") {
    globalThis.__dirname = dirname(globalThis.__filename);
  }
  if (typeof globalThis.require === "undefined") {
    const { default: module } = await import("module");
    globalThis.require = module.createRequire(import.meta.url);
  }
})();
`
const options = {
    entryPoints: ['src/index.js'],
    bundle: true,
    platform: 'node',
    outfile: './build/koop-provider.quickbase.prod.js',
    minify: true,
    target: 'esnext',
    format: 'esm',
    banner: {js: ESM_REQUIRE_SHIM},
    // drop: ['console', 'debugger'],
}

await esbuild.build(options)
