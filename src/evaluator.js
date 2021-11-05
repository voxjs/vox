import { map } from './utils.js';

const cache = map();

const evaluator = (expression) => (
  cache[expression] || (
    cache[expression] = new Function(
      'with(this)return' + (
        (expression)
          ? `(${expression})`
          : ';'
      )
    )
  )
);

export { evaluator };
