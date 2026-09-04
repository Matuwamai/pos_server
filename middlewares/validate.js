import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';
// Usage: router.post('/products', validate(createProductSchema), controller.create)
//
// Pass a schema shaped like { body?, params?, query? } and this validates +
// REPLACES req.body/params/query with the parsed (type-coerced/defaulted)
// result, so controllers can trust the shape of what they receive.
function validate(schema) {
  return (req, res, next) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.params) req.params = schema.params.parse(req.params);
      if (schema.query) req.query = schema.query.parse(req.query);
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
