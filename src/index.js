import { vox } from './vox.js';
import { api } from './api.js';
import { config } from './config.js';
import { name, version } from '../package.json';
import { define } from './utils.js';

define(vox, {
  api: {
    value: api
  },
  config: {
    value: config
  },
  name: {
    value: name
  },
  version: {
    value: version
  }
});

export { vox as default };
