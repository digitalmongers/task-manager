/**
 * Middleware to attach user's timezone preference to the request object
 */
export const timezoneMiddleware = (req, res, next) => {
  if (req.user && req.user.timezone) {
    req.timezone = req.user.timezone;
  } else {
    req.timezone = 'UTC'; // Fallback
  }
  next();
};
