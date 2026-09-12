class ApiError extends Error {
  // isOperational = true means "an expected, handled failure" (bad input,
  // missing record, auth failure) — the error handler logs these at warn.
  // isOperational = false means a genuine bug — logged at error level with
  // a full stack trace so it surfaces in monitoring.
  constructor(statusCode, message, details = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  // 402 = the tenant's subscription has lapsed, or their plan doesn't
  // include the requested feature. `details.code` lets clients tell the two
  // apart: SUBSCRIPTION_EXPIRED should close the app to a renewal page,
  // FEATURE_NOT_AVAILABLE should just show an upsell for that one action.
  static paymentRequired(message, details) {
    return new ApiError(402, message, details);
  }

  // 422 = "your request was well-formed but the data didn't pass validation"
  static unprocessable(message, details) {
    return new ApiError(422, message, details);
  }
}
export default ApiError;
