import { isReactive } from '@vue/reactivity';
import {
  camelize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isObject,
  isString
} from '@vue/shared';

const define = Object.defineProperties;

const descriptor = Object.getOwnPropertyDescriptor;

const directives = [
  'skip',
  'vox',
  'for',
  'if',
  'init',
  '*',
  'exit'
];

const map = (...args) => extend(
  Object.create(null),
  ...args
);

const keys = map({
  'accept-charset': 'acceptCharset',
  'accesskey': 'accessKey',
  'colspan': 'colSpan',
  'contenteditable': 'contentEditable',
  'crossorigin': 'crossOrigin',
  'dirname': 'dirName',
  'enterkeyhint': 'enterKeyHint',
  'formaction': 'formAction',
  'formenctype': 'formEnctype',
  'formmethod': 'formMethod',
  'formnovalidate': 'formNoValidate',
  'formtarget': 'formTarget',
  'html': 'innerHTML',
  'http-equiv': 'httpEquiv',
  'inputmode': 'inputMode',
  'ismap': 'isMap',
  'maxlength': 'maxLength',
  'minlength': 'minLength',
  'nomodule': 'noModule',
  'novalidate': 'noValidate',
  'readonly': 'readOnly',
  'referrerpolicy': 'referrerPolicy',
  'tabindex': 'tabIndex',
  'text': 'textContent',
  'usemap': 'useMap'
});

const noop = () => {};

const normalize = (value) => {
  let classes;
  if (isString(value)) {
    classes = (
      value.split(/\s+/)
        .filter(Boolean)
    );
  } else {
    classes = [];
    if (isArray(value)) {
      for (const item of value) {
        classes.push(
          ...normalize(item)
        );
      }
    } else if (isObject(value)) {
      for (const name in value) {
        if (name && value[name]) {
          classes.push(name);
        }
      }
    } else if (value != null) {
      classes.push(value);
    }
  }
  return classes;
};

const reducer = (accumulator, value) => {
  if (value) {
    const _ = value.split(':');
    accumulator[_[0]] = _[1] || _[0];
  }
  return accumulator;
};

const voxRE = /^vox(?::([a-z-]+)([:a-z0-9-]+)?([.:a-z0-9-]+)?)?$/;

export {
  camelize,
  define,
  descriptor,
  directives,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isObject,
  isReactive,
  isString,
  keys,
  map,
  noop,
  normalize,
  reducer,
  voxRE
};
