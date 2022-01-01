import { define } from './utils.js';

const api = define({}, {
  app: {
    value: {
      emit(event, detail) {
        (this.el || document)
          .dispatchEvent(
            new CustomEvent(event, {
              bubbles: true,
              cancelable: true,
              composed: true,
              detail
            })
          );
      },
      vox(index) {}
    },
    configurable: true,
    enumerable: true
  }
});

export { api };
