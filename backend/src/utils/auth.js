const SECRET_KEY = process.env.CHAINHOOK_SECRET_KEY;

const verifySecret = (headers) => {
  const authHeader = headers.authorization;
  return authHeader && authHeader === SECRET_KEY;
};

/**
 * Middleware for checking authorization.
 */
function requireAuth(req, res, next) {
  if (!verifySecret(req.headers)) {
    return res.status(403).json({ error: "Forbidden: Invalid authorization" });
  }
  next();
}

module.exports = {
  requireAuth,
};
