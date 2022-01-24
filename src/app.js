import { api } from './api.js';
import { context } from './context.js';
import {
  reactive,
  readonly,
  shallowReadonly
} from './reactivity.js';
import { freeze } from './utils.js';

let value;

const app = () => {
  if (!value) {
    value = context(
      readonly({
        el: null
      }),
      reactive(api.app)
    );
    value.data.push(
      shallowReadonly({
        app: value,
        els: readonly({}),
        vox: (index) => (
          (index === void(0))
            ? value
            : void(0)
        )
      })
    );
    freeze(value.data);
  }
  return value;
};

export { app };
