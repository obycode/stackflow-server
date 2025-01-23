const SECRET_KEY = process.env.CHAINHOOK_SECRET_KEY;

const verifySecret = (headers) => {
  const authHeader = headers.authorization;
  return authHeader && authHeader === SECRET_KEY;
};

module.exports = {
  verifySecret,
};
