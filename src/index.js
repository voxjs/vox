import { vox } from './vox.js';
import { api } from './api.js';
import { config } from './config.js';
import { version } from '../package.json';
import { define } from './utils.js';

define(vox, {
  api: {
    value: api
  },
  config: {
    value: config
  },
  name: {
    value: 'vox'
  },
  version: {
    value: version
  }
});

export { vox as default };
