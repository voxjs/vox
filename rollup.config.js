import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.js',
  plugins: [
    resolve(),
    json({
      preferConst: true
    }),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ],
  output: [
    {
      name: 'vox',
      format: 'es',
      file: 'dist/vox.mjs'
    },
    {
      name: 'vox',
      format: 'es',
      plugins: [
        terser({
          ecma: 2015,
          mangle: {
            keep_fnames: /^vox$/i
          }
        })
      ],
      file: 'dist/vox.min.mjs'
    },
    {
      name: 'vox',
      format: 'iife',
      file: 'dist/vox.js'
    },
    {
      name: 'vox',
      format: 'iife',
      plugins: [
        terser({
          ecma: 2015,
          mangle: {
            keep_fnames: /^vox$/i
          }
        })
      ],
      file: 'dist/vox.min.js'
    }
  ]
};
