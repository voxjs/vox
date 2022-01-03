import { api } from './api.js';
import { context } from './context.js';
import {
  reactive,
  readonly,
  shallowReadonly
} from './reactivity.js';

const _ = {
  get app() {
    const app = context([
      readonly({
        el: null
      }),
      readonly({
        els: {}
      }),
      reactive(api.app)
    ]);
    app.__vox__.push(
      shallowReadonly({ app })
    );
    delete this.app;
    return this.app = app;
  }
};

const closest = (el) => {
  if (el.parentElement) {
    return (
      el.parentElement
        .__vox || _.app
    );
  }
  return _.app;
};

export { closest };
