const pool = require("../utils/db");

// Fetch all channels
exports.fetchChannels = async () => {
  const result = await pool.query("SELECT * FROM channels");
  return result.rows;
};

// Add a new channel
exports.addChannel = async (channelData) => {
  const {
    token,
    principal_1,
    principal_2,
    balance_1,
    balance_2,
    nonce,
    expires_at,
  } = channelData;
  const result = await pool.query(
    `INSERT INTO channels (token, principal_1, principal_2, balance_1, balance_2, nonce, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [token, principal_1, principal_2, balance_1, balance_2, nonce, expires_at]
  );
  return result.rows[0];
};
