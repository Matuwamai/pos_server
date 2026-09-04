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

  // 422 = "your request was well-formed but the data didn't pass validation"
  static unprocessable(message, details) {
    return new ApiError(422, message, details);
  }
}
export default ApiError;
