(function () {
  function defineGetter(target, property, getter) {
    try {
      Object.defineProperty(target, property, {
        configurable: true,
        get: getter
      });
    } catch (_error) {
      // Some browser properties may be non-configurable in specific frames.
    }
  }

  defineGetter(Document.prototype, "hidden", () => false);
  defineGetter(Document.prototype, "webkitHidden", () => false);
  defineGetter(Document.prototype, "visibilityState", () => "visible");
  defineGetter(Document.prototype, "webkitVisibilityState", () => "visible");

  try {
    Document.prototype.hasFocus = function () {
      return true;
    };
  } catch (_error) {
    // Ignore if the frame does not allow patching Document.prototype.
  }
})();
