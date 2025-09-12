import esbuild from 'esbuild';

esbuild
  .build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: ['node22'],
    format: 'esm',
    outfile: 'dist/index.js',
    sourcemap: true,
    minify: false,
    external: [
      'express',
      'pg',
      'ws'
    ],
  })
  .then(() => {
    console.log('Build successfully');
  })
  .catch(() => process.exit(1));
