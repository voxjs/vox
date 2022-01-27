import { define } from './utils.js';

const api = define({}, {
  app: {
    value: {
      emit(event, data) {
        (this.el || document)
          .dispatchEvent(
            new CustomEvent(event, {
              bubbles: true,
              cancelable: true,
              composed: true,
              detail: {
                ...data
              }
            })
          );
      }
    },
    configurable: true,
    enumerable: true
  }
});

export { api };
