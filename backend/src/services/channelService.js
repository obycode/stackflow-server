const { get } = require("../routes/ownerRoutes");

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

async function getChannelsWith(client, principal) {
  try {
    const query = `
    SELECT *
    FROM channels
    WHERE principal_1 = $1
    OR principal_2 = $1
  `;
    const result = await client.query(query, [principal]);

    return result.rows;
  } catch (error) {
    console.error("Error fetching channels:", error);
    throw error;
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
      expiresAt?.toString() ?? null,
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
      expiresAt?.toString() ?? null,
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

async function insertPendingSignatures(
  client,
  channelId,
  balance1,
  balance2,
  nonce,
  action,
  actor,
  hashedSecret,
  ownerSignature,
  otherSignature,
  dependsOnChannel,
  dependsOnNonce
) {
  await client.query(
    `
    INSERT INTO pending_signatures (
      channel, balance_1, balance_2, nonce, action, actor, hashed_secret, owner_signature, other_signature, depends_on_channel, depends_on_nonce
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (channel)
    DO UPDATE SET
      balance_1 = EXCLUDED.balance_1,
      balance_2 = EXCLUDED.balance_2,
      nonce = EXCLUDED.nonce,
      action = EXCLUDED.action,
      actor = EXCLUDED.actor,
      hashed_secret = EXCLUDED.hashed_secret,
      owner_signature = EXCLUDED.owner_signature,
      other_signature = EXCLUDED.other_signature,
      depends_on_channel = EXCLUDED.depends_on_channel,
      depends_on_nonce = EXCLUDED.depends_on_nonce;
    `,
    [
      channelId,
      balance1.toString(),
      balance2.toString(),
      nonce.toString(),
      action,
      actor,
      hashedSecret,
      ownerSignature,
      otherSignature,
      dependsOnChannel,
      dependsOnNonce,
    ]
  );
}

async function confirmSignatures(client, channelId, nonce, secret) {
  try {
    await client.query("BEGIN");

    // Step 1: Retrieve the pending signature
    const selectQuery = `
      SELECT * FROM pending_signatures
      WHERE depends_on_channel = $1 AND depends_on_nonce = $2
      FOR UPDATE; -- Locks row to prevent race conditions
    `;
    const { rows } = await client.query(selectQuery, [channelId, nonce]);

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      console.error("No matching pending signature found.");
      return null;
    }

    const pendingSignature = rows[0];

    // Step 2: Verify the secret hash
    const secretHash = crypto.createHash("sha256").update(secret).digest("hex");

    if (secretHash !== pendingSignature.secret_hash) {
      await client.query("ROLLBACK");
      console.error("Secret does not match the expected hash.");
      return null;
    }

    // Step 3: Move to `signatures` table
    const insertQuery = `
      INSERT INTO signatures (channel, balance_1, balance_2, nonce, action, actor, secret, owner_signature, other_signature)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const insertValues = [
      pendingSignature.channel,
      pendingSignature.balance_1,
      pendingSignature.balance_2,
      pendingSignature.nonce,
      pendingSignature.action,
      pendingSignature.actor,
      secret, // Store the actual secret, not the hash
      pendingSignature.owner_signature,
      pendingSignature.other_signature,
    ];
    const insertedRow = await client.query(insertQuery, insertValues);

    // Step 4: Delete from `pending_signatures`
    const deleteQuery = `
      DELETE FROM pending_signatures WHERE id = $1;
    `;
    await client.query(deleteQuery, [pendingSignature.id]);

    await client.query("COMMIT");
    return insertedRow.rows[0]; // Return the newly inserted row
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error moving pending signature:", error);
    throw error;
  }
}

module.exports = {
  getChannel,
  getChannelsWith,
  insertChannel,
  updateChannel,
  getSignatures,
  insertSignatures,
  insertPendingSignatures,
  confirmSignatures,
};
