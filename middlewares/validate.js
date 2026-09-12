import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';

function validate(schema) {
  return (req, res, next) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.params) req.params = schema.params.parse(req.params);
      // req.query is a getter-only accessor in Express 5 (reassigning it
      // throws), so the parsed/coerced/defaulted query goes on its own
      // property instead. Controllers must read req.validatedQuery, not
      // req.query, to get defaults like page/limit applied.
      if (schema.query) req.validatedQuery = schema.query.parse(req.query);
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        return next(ApiError.unprocessable('Validation failed', details));
      }
      return next(err);
    }
  };
}

export default validate;
