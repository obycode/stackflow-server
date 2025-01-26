/**
 * Helper: Check if the channel exists.
 */
async function getChannel(client, principal1, principal2, token) {
  try {
    const query = `
    SELECT *
    FROM channels
    WHERE principal_1 = $1
      AND principal_2 = $2
      ${token ? "AND token = $3" : "AND token IS NULL"}
  `;
    const params = token
      ? [principal1, principal2, token]
      : [principal1, principal2];
    const result = await client.query(query, params);

    // Handle case where no rows are returned
    if (result.rowCount === 0) {
      return null; // Explicitly return null if no channel is found
    }

    return result.rows[0]; // Return the channel data
  } catch (error) {
    console.error("Error fetching channel:", error);
    throw error; // Re-throw the error to handle it at a higher level
  }
}

/**
 * Insert a new channel.
 */
async function insertChannel(
  client,
  principal1,
  principal2,
  token,
  balance1,
  balance2,
  nonce,
  expiresAt,
  state
) {
  const channelId = await client.query(
    `INSERT INTO channels (principal_1, principal_2, token, balance_1, balance_2, nonce, expires_at, state) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      principal1,
      principal2,
      token || null,
      balance1.toString(),
      balance2.toString(),
      nonce.toString(),
      expiresAt.toString(),
      state,
    ]
  );

  return channelId.rows[0].id;
}

/**
 * Update a channel.
 */
async function updateChannel(
  client,
  channelId,
  balance1,
  balance2,
  nonce,
  expiresAt,
  state
) {
  await client.query(
    `UPDATE channels 
     SET balance_1 = $1, balance_2 = $2, nonce = $3, expires_at = $4, state = $5
     WHERE id = $6`,
    [
      balance1.toString(),
      balance2.toString(),
      nonce.toString(),
      expiresAt.toString(),
      state,
      channelId,
    ]
  );
}

/**
 * Get the signatures for a channel.
 */
async function getSignatures(client, channelId) {
  const result = await client.query(
    `SELECT * FROM signatures WHERE channel = $1`,
    [channelId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

async function insertSignatures(
  client,
  channelId,
  balance1,
  balance2,
  nonce,
  action,
  actor,
  secret,
  ownerSignature,
  otherSignature
) {
  await client.query(
    `
    INSERT INTO signatures (
      channel, balance_1, balance_2, nonce, action, actor, secret, owner_signature, other_signature
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (channel)
    DO UPDATE SET
      balance_1 = EXCLUDED.balance_1,
      balance_2 = EXCLUDED.balance_2,
      nonce = EXCLUDED.nonce,
      action = EXCLUDED.action,
      actor = EXCLUDED.actor,
      secret = EXCLUDED.secret,
      owner_signature = EXCLUDED.owner_signature,
      other_signature = EXCLUDED.other_signature;
    `,
    [
      channelId,
      balance1.toString(),
      balance2.toString(),
      nonce.toString(),
      action,
      actor,
      secret,
      ownerSignature,
      otherSignature,
    ]
  );
}

module.exports = {
  getChannel,
  insertChannel,
  updateChannel,
  getSignatures,
  insertSignatures,
};