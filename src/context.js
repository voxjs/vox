import {
  define,
  descriptor,
  hasOwn,
  isReactive
} from './utils.js';

const cache = (vox, arr, obj, key, alt) => {
  if (!(key in obj)) {
    const owner = (
      arr.find(
        (obj) => hasOwn(obj, key)
      ) ||
      alt && arr.find(isReactive)
    );
    if (owner) {
      const {
        get,
        set,
        writable
      } = (
        descriptor(owner, key) ||
        {}
      );
      const _ = {};
      if (get || set) {
        if (get) {
          _.get = () => get.call(vox);
        }
        if (set) {
          _.set = (value) => {
            set.call(vox, value);
          };
        }
      } else {
        _.get = () => owner[key];
        if (writable !== false) {
          _.set = (value) => {
            owner[key] = value;
          }
        }
      }
      define(obj, {
        [key]: {
          get: _.get || (() => void(0)),
          set: _.set || ((value) => {}),
          configurable: true
        }
      });
    }
  }
  return obj;
};

const context = (arr) => {
  let vox;
  return (
    vox = new Proxy({}, {
      get: (obj, key) => {
        if (key === Symbol.unscopables) {
          return;
        }
        if (key === '__vox__') {
          return arr;
        }
        return (
          Reflect.get(
            cache(vox, arr, obj, key),
            key
          )
        );
      },
      has: (obj, key) => (
        Reflect.has(
          cache(vox, arr, obj, key),
          key
        )
      ),
      set: (obj, key, value) => (
        Reflect.set(
          cache(vox, arr, obj, key, true),
          key,
          value
        )
      )
    })
  );
};

export { context };
