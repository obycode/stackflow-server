const { verifySecret } = require("../utils/auth");
const pool = require("../utils/db");

const owner = process.env.OWNER_ADDRESS;

const Action = {
  Close: 0,
  Transfer: 1,
  Deposit: 2,
  Withdraw: 3,
};

/**
 * Handle fund-channel chainhook events.
 * @param {Request} req
 * @param {Response} res
 */
async function handleFundChannelEvent(req, res) {
  try {
    if (!verifySecret(req.headers)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Invalid authorization" });
    }

    // Parse the event payload
    const { apply } = req.body;
    if (!apply || !Array.isArray(apply)) {
      return res.status(400).json({ error: "Invalid payload structure" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const block of apply) {
        const transactions = block.transactions || [];
        for (const tx of transactions) {
          const events = tx.metadata?.receipt?.events || [];
          for (const event of events) {
            if (
              event.type === "SmartContractEvent" &&
              event.data?.value?.event === "fund-channel"
            ) {
              console.info("fund-channel event:", event.data.value);
              const {
                amount,
                channel: {
                  "balance-1": balance1,
                  "balance-2": balance2,
                  "expires-at": expiresAt,
                  nonce,
                },
                "channel-key": {
                  "principal-1": principal1,
                  "principal-2": principal2,
                  token,
                },
                sender,
              } = event.data.value;

              // If this channel doesn't involve the owner, we can ignore it
              if (principal1 !== owner && principal2 !== owner) {
                console.info(
                  `Ignoring fund-channel event not involving owner.`
                );
                continue; // Skip further processing for this event
              }

              // Check if the channel exists
              let query = `
                SELECT *
                FROM channels
                WHERE principal_1 = $1
                  AND principal_2 = $2
              `;
              let params = [principal1, principal2];
              if (token) {
                query += `AND token = $3`;
                params.push(token);
              } else {
                query += `AND token IS NULL`;
              }
              const result = await client.query(query, params);

              if (result.rowCount > 0) {
                const channel = result.rows[0];
                const isSender1 = sender === principal1;

                // Check if the sender's balance is already non-zero
                if (
                  (isSender1 && channel.balance_1 > 0) ||
                  (!isSender1 && channel.balance_2 > 0)
                ) {
                  console.warn(
                    `fund-channel event for an already funded channel.`
                  );
                  continue; // Skip further processing for this event
                }

                // Update the balance of the sender
                await client.query(
                  `UPDATE channels 
                  SET balance_1 = $1, balance_2 = $2, nonce = $3, expires_at = $4, state = 'open'
                  WHERE id = $5`,
                  [
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                    channel.id,
                  ]
                );
                console.info(`Channel updated successfully`);
              } else {
                // Insert a new channel if it doesn't exist
                await client.query(
                  `INSERT INTO channels (principal_1, principal_2, token, balance_1, balance_2, nonce, expires_at, state) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')`,
                  [
                    principal1,
                    principal2,
                    token || null,
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                  ]
                );
                console.info(`New channel created successfully`);
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Event processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error handling fund-channel event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleCloseChannelEvent(req, res) {
  try {
    if (!verifySecret(req.headers)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Invalid authorization" });
    }

    // Parse the event payload
    const { apply } = req.body;
    if (!apply || !Array.isArray(apply)) {
      return res.status(400).json({ error: "Invalid payload structure" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const block of apply) {
        const transactions = block.transactions || [];
        for (const tx of transactions) {
          const events = tx.metadata?.receipt?.events || [];
          for (const event of events) {
            if (
              event.type === "SmartContractEvent" &&
              event.data?.value?.event === "close-channel"
            ) {
              console.info("close-channel event:", event.data.value);
              const {
                channel: {
                  "balance-1": balance1,
                  "balance-2": balance2,
                  "expires-at": expiresAt,
                  nonce,
                },
                "channel-key": {
                  "principal-1": principal1,
                  "principal-2": principal2,
                  token,
                },
                sender,
              } = event.data.value;

              // If this channel doesn't involve the owner, we can ignore it
              if (principal1 !== owner && principal2 !== owner) {
                console.info(
                  `Ignoring close-channel event not involving owner.`
                );
                continue; // Skip further processing for this event
              }

              // Check if the channel exists
              let query = `
                SELECT *
                FROM channels
                WHERE principal_1 = $1
                  AND principal_2 = $2
              `;
              let params = [principal1, principal2];
              if (token) {
                query += `AND token = $3`;
                params.push(token);
              } else {
                query += `AND token IS NULL`;
              }
              const result = await client.query(query, params);

              if (result.rowCount > 0) {
                const channel = result.rows[0];

                // Check if the channel is currently open
                if (channel.state !== "open") {
                  console.warn(
                    `close-channel event for a channel in state ${channel.state}.`
                  );
                  continue; // Skip further processing for this event
                }

                // Update the state of the channel
                await client.query(
                  `UPDATE channels 
                  SET balance_1 = $1, balance_2 = $2, nonce = $3, expires_at = $4, state = 'closed'
                  WHERE id = $5`,
                  [
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                    channel.id,
                  ]
                );
                console.info(`Channel updated successfully`);
              } else {
                // Insert a new channel if it doesn't exist
                await client.query(
                  `INSERT INTO channels (principal_1, principal_2, token, balance_1, balance_2, nonce, expires_at, state) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, 'closed')`,
                  [
                    principal1,
                    principal2,
                    token || null,
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                  ]
                );
                console.warn(`New channel created for close event`);
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Event processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error handling close-channel event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleForceCancelEvent(req, res) {
  try {
    if (!verifySecret(req.headers)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Invalid authorization" });
    }

    // Parse the event payload
    const { apply } = req.body;
    if (!apply || !Array.isArray(apply)) {
      return res.status(400).json({ error: "Invalid payload structure" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const block of apply) {
        const transactions = block.transactions || [];
        for (const tx of transactions) {
          const events = tx.metadata?.receipt?.events || [];
          for (const event of events) {
            if (
              event.type === "SmartContractEvent" &&
              event.data?.value?.event === "force-cancel"
            ) {
              console.info("force-cancel event:", event.data.value);
              const {
                channel: {
                  "balance-1": balance1,
                  "balance-2": balance2,
                  "expires-at": expiresAt,
                  nonce,
                },
                "channel-key": {
                  "principal-1": principal1,
                  "principal-2": principal2,
                  token,
                },
                sender,
              } = event.data.value;

              // If this channel doesn't involve the owner, we can ignore it
              if (principal1 !== owner && principal2 !== owner) {
                console.info(
                  `Ignoring force-cancel event not involving owner.`
                );
                continue; // Skip further processing for this event
              }

              // If the sender is the owner, then there is nothing to do
              if (sender === owner) {
                console.info(`Ignoring force-cancel event from the owner.`);
                continue; // Skip further processing for this event
              }

              // Check if the channel exists
              let query = `
                SELECT *
                FROM channels
                WHERE principal_1 = $1
                  AND principal_2 = $2
              `;
              let params = [principal1, principal2];
              if (token) {
                query += `AND token = $3`;
                params.push(token);
              } else {
                query += `AND token IS NULL`;
              }
              const result = await client.query(query, params);

              if (result.rowCount > 0) {
                const channel = result.rows[0];

                // Check if the channel is currently open
                if (channel.state !== "open") {
                  console.warn(
                    `force-cancel event for a channel in state ${channel.state}.`
                  );
                  continue; // Skip further processing for this event
                }

                // Retrieve the saved signatures we have for the channel
                const sigResult = await client.query(
                  `SELECT * FROM signatures WHERE channel = $1`,
                  [channel.id]
                );

                // If we have signatures, submit a call to `dispute-closure`
                if (sigResult.rowCount > 0) {
                  const signatures = sigResult.rows[0];

                  // If our balance is higher than the cancellation balance, we can dispute
                  const cancelBalance =
                    owner === principal1 ? balance1 : balance2;
                  const signatureBalance =
                    owner === principal1
                      ? signatures.balance_1
                      : signatures.balance_2;

                  if (BigInt(signatureBalance) > BigInt(cancelBalance)) {
                    // Submit a call to the contract to dispute the closure
                    console.info(`Disputing channel closure`);

                    // TODO: make call to `dispute-closure`
                  }
                }
              } else {
                // Insert a new channel if it doesn't exist
                await client.query(
                  `INSERT INTO channels (principal_1, principal_2, token, balance_1, balance_2, nonce, expires_at, state) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')`,
                  [
                    principal1,
                    principal2,
                    token || null,
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                  ]
                );
                console.warn(`New channel created for force-cancel event`);
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Event processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error handling force-cancel event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleForceCloseEvent(req, res) {
  try {
    if (!verifySecret(req.headers)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Invalid authorization" });
    }

    // Parse the event payload
    const { apply } = req.body;
    if (!apply || !Array.isArray(apply)) {
      return res.status(400).json({ error: "Invalid payload structure" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const block of apply) {
        const transactions = block.transactions || [];
        for (const tx of transactions) {
          const events = tx.metadata?.receipt?.events || [];
          for (const event of events) {
            if (
              event.type === "SmartContractEvent" &&
              event.data?.value?.event === "force-close"
            ) {
              console.info("force-close event:", event.data.value);
              const {
                channel: {
                  "balance-1": balance1,
                  "balance-2": balance2,
                  "expires-at": expiresAt,
                  nonce,
                },
                "channel-key": {
                  "principal-1": principal1,
                  "principal-2": principal2,
                  token,
                },
                sender,
              } = event.data.value;

              // If this channel doesn't involve the owner, we can ignore it
              if (principal1 !== owner && principal2 !== owner) {
                console.info(`Ignoring force-close event not involving owner.`);
                continue; // Skip further processing for this event
              }

              // If the sender is the owner, then there is nothing to do
              if (sender === owner) {
                console.info(`Ignoring force-close event from the owner.`);
                continue; // Skip further processing for this event
              }

              // Check if the channel exists
              let query = `
                SELECT *
                FROM channels
                WHERE principal_1 = $1
                  AND principal_2 = $2
              `;
              let params = [principal1, principal2];
              if (token) {
                query += `AND token = $3`;
                params.push(token);
              } else {
                query += `AND token IS NULL`;
              }
              const result = await client.query(query, params);

              if (result.rowCount > 0) {
                const channel = result.rows[0];

                // Check if the channel is currently open
                if (channel.state !== "open") {
                  console.warn(
                    `force-cancel event for a channel in state ${channel.state}.`
                  );
                  continue; // Skip further processing for this event
                }

                // Retrieve the saved signatures we have for the channel
                const sigResult = await client.query(
                  `SELECT * FROM signatures WHERE channel = $1`,
                  [channel.id]
                );

                // If we have signatures, submit a call to `dispute-closure`
                if (sigResult.rowCount > 0) {
                  const signatures = sigResult.rows[0];

                  // If our balance is higher than the cancellation balance, we can dispute
                  const cancelBalance =
                    owner === principal1 ? balance1 : balance2;
                  const signatureBalance =
                    owner === principal1
                      ? signatures.balance_1
                      : signatures.balance_2;

                  if (BigInt(signatureBalance) > BigInt(cancelBalance)) {
                    // Submit a call to the contract to dispute the closure
                    console.info(`Disputing channel closure`);

                    // TODO: make call to `dispute-closure`
                  }
                }
              } else {
                // Insert a new channel if it doesn't exist
                await client.query(
                  `INSERT INTO channels (principal_1, principal_2, token, balance_1, balance_2, nonce, expires_at, state) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')`,
                  [
                    principal1,
                    principal2,
                    token || null,
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                  ]
                );
                console.warn(`New channel created for force-close event`);
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Event processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error handling force-close event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleFinalizeEvent(req, res) {
  try {
    if (!verifySecret(req.headers)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Invalid authorization" });
    }

    // Parse the event payload
    const { apply } = req.body;
    if (!apply || !Array.isArray(apply)) {
      return res.status(400).json({ error: "Invalid payload structure" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const block of apply) {
        const transactions = block.transactions || [];
        for (const tx of transactions) {
          const events = tx.metadata?.receipt?.events || [];
          for (const event of events) {
            if (
              event.type === "SmartContractEvent" &&
              event.data?.value?.event === "finalize"
            ) {
              console.info("finalize event:", event.data.value);
              const {
                channel: {
                  "balance-1": balance1,
                  "balance-2": balance2,
                  "expires-at": expiresAt,
                  nonce,
                },
                "channel-key": {
                  "principal-1": principal1,
                  "principal-2": principal2,
                  token,
                },
                sender,
              } = event.data.value;

              // If this channel doesn't involve the owner, we can ignore it
              if (principal1 !== owner && principal2 !== owner) {
                console.info(`Ignoring finalize event not involving owner.`);
                continue; // Skip further processing for this event
              }

              // Check if the channel exists
              let query = `
                SELECT *
                FROM channels
                WHERE principal_1 = $1
                  AND principal_2 = $2
              `;
              let params = [principal1, principal2];
              if (token) {
                query += `AND token = $3`;
                params.push(token);
              } else {
                query += `AND token IS NULL`;
              }
              const result = await client.query(query, params);

              if (result.rowCount > 0) {
                const channel = result.rows[0];

                // Check if the channel is currently open
                if (channel.state !== "open") {
                  console.warn(
                    `finalize event for a channel in state ${channel.state}.`
                  );
                  continue; // Skip further processing for this event
                }

                // Update the state of the channel
                await client.query(
                  `UPDATE channels 
                  SET balance_1 = $1, balance_2 = $2, nonce = $3, expires_at = $4, state = 'closed'
                  WHERE id = $5`,
                  [
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                    channel.id,
                  ]
                );
                console.info(`Channel updated successfully`);
              } else {
                // Insert a new channel if it doesn't exist
                await client.query(
                  `INSERT INTO channels (principal_1, principal_2, token, balance_1, balance_2, nonce, expires_at, state) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, 'closed')`,
                  [
                    principal1,
                    principal2,
                    token || null,
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                  ]
                );
                console.warn(`New channel created for finalize event`);
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Event processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error handling finalize event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleDepositEvent(req, res) {
  try {
    if (!verifySecret(req.headers)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Invalid authorization" });
    }

    // Parse the event payload
    const { apply } = req.body;
    if (!apply || !Array.isArray(apply)) {
      return res.status(400).json({ error: "Invalid payload structure" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const block of apply) {
        const transactions = block.transactions || [];
        for (const tx of transactions) {
          const events = tx.metadata?.receipt?.events || [];
          for (const event of events) {
            if (
              event.type === "SmartContractEvent" &&
              event.data?.value?.event === "deposit"
            ) {
              console.info("deposit event:", event.data.value);
              const {
                channel: {
                  "balance-1": balance1,
                  "balance-2": balance2,
                  "expires-at": expiresAt,
                  nonce,
                },
                "channel-key": {
                  "principal-1": principal1,
                  "principal-2": principal2,
                  token,
                },
                sender,
                amount,
                "my-signature": mySignature,
                "their-signature": theirSignature,
              } = event.data.value;

              // If this channel doesn't involve the owner, we can ignore it
              if (principal1 !== owner && principal2 !== owner) {
                console.info(`Ignoring deposit event not involving owner.`);
                continue; // Skip further processing for this event
              }

              // Check if the channel exists
              let query = `
                SELECT *
                FROM channels
                WHERE principal_1 = $1
                  AND principal_2 = $2
              `;
              let params = [principal1, principal2];
              if (token) {
                query += `AND token = $3`;
                params.push(token);
              } else {
                query += `AND token IS NULL`;
              }
              const result = await client.query(query, params);
              let channel_id;

              if (result.rowCount > 0) {
                const channel = result.rows[0];
                channel_id = channel.id;

                // Check if the channel is currently open
                if (channel.state !== "open") {
                  console.warn(
                    `deposit event for a channel in state ${channel.state}.`
                  );
                  continue; // Skip further processing for this event
                }

                // If our nonce is already higher, we can ignore this event
                if (BigInt(nonce) <= BigInt(channel.nonce)) {
                  console.warn(`Ignoring deposit event with old nonce.`);
                  continue; // Skip further processing for this event
                }

                // Update the state of the channel
                await client.query(
                  `UPDATE channels 
                  SET balance_1 = $1, balance_2 = $2, nonce = $3, expires_at = $4
                  WHERE id = $5`,
                  [
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                    channel.id,
                  ]
                );
                console.info(`Channel updated successfully`);
              } else {
                // Insert a new channel if it doesn't exist
                channel_id = await client.query(
                  `INSERT INTO channels (principal_1, principal_2, token, balance_1, balance_2, nonce, expires_at, state) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
                  RETURNING id`,
                  [
                    principal1,
                    principal2,
                    token || null,
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                  ]
                );
                console.warn(`New channel created for deposit event`);
              }

              let signature1 = mySignature;
              let signature2 = theirSignature;
              if (principal1 !== owner) {
                signature1 = theirSignature;
                signature2 = mySignature;
              }

              // Save the signatures for the channel
              await client.query(
                `INSERT INTO signatures (channel, balance_1, balance_2, nonce, action, actor, secret, owner_signature, other_signature) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  channel_id,
                  balance1.toString(),
                  balance2.toString(),
                  nonce.toString(),
                  Action.Deposit,
                  sender,
                  null,
                  signature1,
                  signature2,
                ]
              );
            }
          }
        }
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Event processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error handling deposit event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleWithdrawEvent(req, res) {
  try {
    if (!verifySecret(req.headers)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Invalid authorization" });
    }

    // Parse the event payload
    const { apply } = req.body;
    if (!apply || !Array.isArray(apply)) {
      return res.status(400).json({ error: "Invalid payload structure" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const block of apply) {
        const transactions = block.transactions || [];
        for (const tx of transactions) {
          const events = tx.metadata?.receipt?.events || [];
          for (const event of events) {
            if (
              event.type === "SmartContractEvent" &&
              event.data?.value?.event === "withdraw"
            ) {
              console.info("withdraw event:", event.data.value);
              const {
                channel: {
                  "balance-1": balance1,
                  "balance-2": balance2,
                  "expires-at": expiresAt,
                  nonce,
                },
                "channel-key": {
                  "principal-1": principal1,
                  "principal-2": principal2,
                  token,
                },
                sender,
                amount,
                "my-signature": mySignature,
                "their-signature": theirSignature,
              } = event.data.value;

              // If this channel doesn't involve the owner, we can ignore it
              if (principal1 !== owner && principal2 !== owner) {
                console.info(`Ignoring withdraw event not involving owner.`);
                continue; // Skip further processing for this event
              }

              // Check if the channel exists
              let query = `
                SELECT *
                FROM channels
                WHERE principal_1 = $1
                  AND principal_2 = $2
              `;
              let params = [principal1, principal2];
              if (token) {
                query += `AND token = $3`;
                params.push(token);
              } else {
                query += `AND token IS NULL`;
              }
              const result = await client.query(query, params);
              let channel_id;

              if (result.rowCount > 0) {
                const channel = result.rows[0];
                channel_id = channel.id;

                // Check if the channel is currently open
                if (channel.state !== "open") {
                  console.warn(
                    `withdraw event for a channel in state ${channel.state}.`
                  );
                  continue; // Skip further processing for this event
                }

                // If our nonce is already higher, we can ignore this event
                if (BigInt(nonce) <= BigInt(channel.nonce)) {
                  console.warn(`Ignoring withdraw event with old nonce.`);
                  continue; // Skip further processing for this event
                }

                // Update the state of the channel
                await client.query(
                  `UPDATE channels 
                  SET balance_1 = $1, balance_2 = $2, nonce = $3, expires_at = $4
                  WHERE id = $5`,
                  [
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                    channel.id,
                  ]
                );
                console.info(`Channel updated successfully`);
              } else {
                // Insert a new channel if it doesn't exist
                channel_id = await client.query(
                  `INSERT INTO channels (principal_1, principal_2, token, balance_1, balance_2, nonce, expires_at, state) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
                  RETURNING id`,
                  [
                    principal1,
                    principal2,
                    token || null,
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                  ]
                );
                console.warn(`New channel created for withdraw event`);
              }

              let signature1 = mySignature;
              let signature2 = theirSignature;
              if (principal1 !== owner) {
                signature1 = theirSignature;
                signature2 = mySignature;
              }

              // Save the signatures for the channel
              await client.query(
                `INSERT INTO signatures (channel, balance_1, balance_2, nonce, action, actor, secret, owner_signature, other_signature) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  channel_id,
                  balance1.toString(),
                  balance2.toString(),
                  nonce.toString(),
                  Action.Deposit,
                  sender,
                  null,
                  signature1,
                  signature2,
                ]
              );
            }
          }
        }
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Event processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error handling withdraw event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleDisputeClosureEvent(req, res) {
  try {
    if (!verifySecret(req.headers)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Invalid authorization" });
    }

    // Parse the event payload
    const { apply } = req.body;
    if (!apply || !Array.isArray(apply)) {
      return res.status(400).json({ error: "Invalid payload structure" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const block of apply) {
        const transactions = block.transactions || [];
        for (const tx of transactions) {
          const events = tx.metadata?.receipt?.events || [];
          for (const event of events) {
            if (
              event.type === "SmartContractEvent" &&
              event.data?.value?.event === "dispute-closure"
            ) {
              console.info("dispute-closure event:", event.data.value);
              const {
                channel: {
                  "balance-1": balance1,
                  "balance-2": balance2,
                  "expires-at": expiresAt,
                  nonce,
                },
                "channel-key": {
                  "principal-1": principal1,
                  "principal-2": principal2,
                  token,
                },
                sender,
              } = event.data.value;

              // If this channel doesn't involve the owner, we can ignore it
              if (principal1 !== owner && principal2 !== owner) {
                console.info(
                  `Ignoring close-channel event not involving owner.`
                );
                continue; // Skip further processing for this event
              }

              // Check if the channel exists
              let query = `
                SELECT *
                FROM channels
                WHERE principal_1 = $1
                  AND principal_2 = $2
              `;
              let params = [principal1, principal2];
              if (token) {
                query += `AND token = $3`;
                params.push(token);
              } else {
                query += `AND token IS NULL`;
              }
              const result = await client.query(query, params);

              if (result.rowCount > 0) {
                const channel = result.rows[0];

                // Check if the channel is currently open
                if (channel.state !== "open") {
                  console.warn(
                    `dispute-closure event for a channel in state ${channel.state}.`
                  );
                  continue; // Skip further processing for this event
                }

                // Update the state of the channel
                await client.query(
                  `UPDATE channels 
                  SET balance_1 = $1, balance_2 = $2, nonce = $3, expires_at = $4, state = 'closed'
                  WHERE id = $5`,
                  [
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                    channel.id,
                  ]
                );
                console.info(`Channel updated successfully`);
              } else {
                // Insert a new channel if it doesn't exist
                await client.query(
                  `INSERT INTO channels (principal_1, principal_2, token, balance_1, balance_2, nonce, expires_at, state) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, 'closed')`,
                  [
                    principal1,
                    principal2,
                    token || null,
                    balance1.toString(),
                    balance2.toString(),
                    nonce.toString(),
                    expiresAt.toString(),
                  ]
                );
                console.warn(`New channel created for dispute-closure event`);
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Event processed successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error handling dispute-closure event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  handleFundChannelEvent,
  handleCloseChannelEvent,
  handleForceCancelEvent,
  handleForceCloseEvent,
  handleFinalizeEvent,
  handleDepositEvent,
  handleWithdrawEvent,
  handleDisputeClosureEvent,
};
