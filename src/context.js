import {
  define,
  descriptor,
  hasOwn,
  isReactive
} from './utils.js';

const cache = (target, key, value, context) => {
  if (!(key in target)) {
    let data = target.data.find(
      (data) => hasOwn(data, key)
    );
    if (!data && value) {
      data = target.data.find(isReactive);
    }
    if (data) {
      const {
        get,
        set,
        writable
      } = (
        descriptor(data, key) || {}
      );
      const _ = {};
      if (get || set) {
        if (get) {
          _.get = () => get.call(context);
        }
        if (set) {
          _.set = (value) => {
            set.call(context, value);
          };
        }
      } else {
        _.get = () => data[key];
        if (writable !== false) {
          _.set = (value) => {
            data[key] = value;
          }
        }
      }
      define(target, {
        [key]: {
          get: _.get || (() => void(0)),
          set: _.set || ((value) => {}),
          configurable: true
        }
      });
    }
  }
  return target;
};

const handler = {
  get: (target, key, context) => (
    (key === Symbol.unscopables)
      ? void(0)
      : Reflect.get(
          cache(target, key, false, context),
          key,
          context
        )
  ),
  has: (target, key) => (
    Reflect.has(target, key) ||
    target.data.some(
      (data) => hasOwn(data, key)
    )
  ),
  set: (target, key, value, context) => (
    Reflect.set(
      cache(target, key, true, context),
      key,
      value,
      context
    )
  )
};

const context = (...data) => (
  new Proxy(
    define({}, {
      data: {
        value: data,
        configurable: true,
        enumerable: false
      }
    }),
    handler
  )
);

export { context };
