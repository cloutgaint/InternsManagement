import Layer from "express/lib/router/layer.js";

// Express 4 ignores rejected promises from async handlers, and an unhandled rejection ends the
// process. Forward them to the error middleware so one failing request cannot stop the API.

Layer.prototype.handle_request = function (req, res, next) {
  const handler = this.handle;
  if (handler.length > 3) return next();
  try {
    const result = handler(req, res, next);
    if (result && typeof result.catch === "function") result.catch(next);
  } catch (error) {
    next(error);
  }
};

