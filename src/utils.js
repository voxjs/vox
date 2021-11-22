import { isReactive } from '@vue/reactivity';
import {
  camelize,
  extend,
  hasOwn,
  isArray,
  isObject,
  isString
} from '@vue/shared';

const define = Object.defineProperties;

const descriptor = Object.getOwnPropertyDescriptor;

const map = (...args) => extend(
  Object.create(null),
  ...args
);

const noop = () => {};

const bindings = map({
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

const controls = map({
  back: {
    button: 3
  },
  del: {
    keys: [ 'Backspace', 'Delete' ]
  },
  delete: {
    keys: [ 'Backspace', 'Delete' ]
  },
  down: {
    keys: [ 'ArrowDown', 'Down' ]
  },
  enter: {
    keys: [ 'Enter' ]
  },
  esc: {
    keys: [ 'Escape', 'Esc' ]
  },
  escape: {
    keys: [ 'Escape', 'Esc' ]
  },
  forward: {
    button: 4
  },
  left: {
    button: 0,
    keys: [ 'ArrowLeft', 'Left' ]
  },
  mid: {
    button: 1
  },
  middle: {
    button: 1
  },
  right: {
    button: 2,
    keys: [ 'ArrowRight', 'Right' ]
  },
  space: {
    keys: [ ' ', 'Spacebar' ]
  },
  tab: {
    keys: [ 'Tab' ]
  },
  up: {
    keys: [ 'ArrowUp', 'Up' ]
  }
});

const specials = [
  'skip',
  'vox',
  'for',
  'if',
  'is',
  'init',
  '*',
  'exit'
];

const classify = (value) => {
  if (isString(value)) {
    return value.trim();
  }
  if (isArray(value)) {
    return value.map(classify).join(' ');
  }
  if (isObject(value)) {
    return (
      Object.keys(value)
        .filter((key) => value[key])
        .join(' ')
    );
  }
  if (value != null) {
    return classify(
      value.toString()
    );
  }
  return '';
};

const styleify = (value) => {
  if (isString(value)) {
    return value.trim();
  }
  if (isArray(value)) {
    return value.map(styleify).join(';');
  }
  if (isObject(value)) {
    return (
      Object.keys(value)
        .map((key) => `${key}:${value[key]}`)
        .join(';')
    );
  }
  if (value != null) {
    return styleify(
      value.toString()
    );
  }
  return '';
};

const voxRE = /^vox(?::([a-z-]+)([:a-z0-9-]+)?([.a-z0-9-]+)?)?$/;

export {
  bindings,
  camelize,
  classify,
  controls,
  define,
  descriptor,
  extend,
  hasOwn,
  isArray,
  isObject,
  isReactive,
  isString,
  map,
  noop,
  specials,
  styleify,
  voxRE
};
