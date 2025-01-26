const {
  CHANNEL_STATE,
  ACTION,
  OWNER,
  PRIVATE_KEY,
} = require("../utils/constants");
const pool = require("../utils/db");
const { verifySignature, generateSignature } = require("../utils/signature");
const { getChannel, insertSignatures } = require("../services/channelService");

async function handleTransfer(req, res) {
  const {
    amount,
    token,
    "principal-1": principal1,
    "principal-2": principal2,
    "balance-1": balance1,
    "balance-2": balance2,
    nonce,
    "hashed-secret": hashedSecret,
    signature,
    "next-hops": nextHops,
    "next-hop": nextHop,
  } = req.body;

  try {
    const client = await pool.connect();
    await client.query("BEGIN");

    const channel = await getChannel(client, principal1, principal2, token);

    if (!channel) {
      return res.status(403).json({ error: "Channel does not exist." });
    }

    const sender = principal1 === OWNER ? principal2 : principal1;

    // Check if the nonce is valid
    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      return res.status(409).json({ error: "Nonce conflict.", channel });
    }

    // We will only automatically sign off on an incoming transfer and the
    // balances must be correct.
    const myBalance =
      principal1 === OWNER ? BigInt(balance1) : BigInt(balance2);
    const theirBalance =
      principal1 === OWNER ? BigInt(balance2) : BigInt(balance1);
    const myPrevBalance =
      principal1 === OWNER
        ? BigInt(channel.balance1)
        : BigInt(channel.balance2);
    const theirPrevBalance =
      principal1 === OWNER
        ? BigInt(channel.balance2)
        : BigInt(channel.balance1);
    if (
      myPrevBalance + BigInt(amount) !== myBalance ||
      theirPrevBalance - BigInt(amount) !== theirBalance
    ) {
      return res.status(403).json({ error: "Invalid transfer balance.", channel });
    }

    // Validate the signature
    const isValid = verifySignature(
      signature,
      
    );

    if (!isValid || BigInt(nonce) <= BigInt(channel.nonce)) {
      return res.status(403).json({ error: "Invalid transfer signature." });
    }

    // Add the signature to the database
    const ownerSignature = generateSignature(PRIVATE_KEY, token);
    await insertSignatures(
      client,
      channel.id,
      balance1,
      balance2,
      nonce,
      "transfer",
      principal2,
      hashedSecret || null,
      ownerSignature,
      signature
    );

    if (nextHops && nextHop !== null) {
      // Logic to initiate the next transfer hop
      console.log("Initiating next hop for the transfer:", nextHop);
      // TODO: Trigger next-hop transfer logic here
    }

    await client.query("COMMIT");
    res.status(200).json({ signature: ownerSignature });
  } catch (error) {
    console.error("Error handling transfer:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleDeposit(req, res) {
  const {
    amount,
    token,
    "principal-1": principal1,
    "principal-2": principal2,
    "balance-1": balance1,
    "balance-2": balance2,
    nonce,
    signature,
  } = req.body;

  try {
    const client = await pool.connect();
    await client.query("BEGIN");

    const channel = await getChannel(client, principal1, principal2, token);

    if (!channel) {
      return res.status(403).json({ error: "Channel does not exist." });
    }

    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      return res.status(409).json({ error: "Nonce conflict." });
    }

    // Validate the deposit action
    const isValid = verifySignature(
      signature,
      { balance1, balance2, nonce, amount },
      principal2
    );

    if (!isValid) {
      return res.status(403).json({ error: "Invalid deposit signature." });
    }

    // Add the signature to the database
    const ownerSignature = generateSignature(
      { balance1, balance2, nonce, amount },
      principal1
    );
    await insertSignatures(
      client,
      channel.id,
      balance1,
      balance2,
      nonce,
      "deposit",
      principal2,
      null,
      ownerSignature,
      signature
    );

    await client.query("COMMIT");
    res.status(200).json({ signature: ownerSignature });
  } catch (error) {
    console.error("Error handling deposit:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleWithdraw(req, res) {
  const {
    amount,
    token,
    "principal-1": principal1,
    "principal-2": principal2,
    "balance-1": balance1,
    "balance-2": balance2,
    nonce,
    signature,
  } = req.body;

  try {
    const client = await pool.connect();
    await client.query("BEGIN");

    const channel = await getChannel(client, principal1, principal2, token);

    if (!channel) {
      return res.status(403).json({ error: "Channel does not exist." });
    }

    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      return res.status(409).json({ error: "Nonce conflict." });
    }

    // Validate the withdrawal action
    const isValid = verifySignature(
      signature,
      { balance1, balance2, nonce, amount },
      principal2
    );

    if (!isValid) {
      return res.status(403).json({ error: "Invalid withdraw signature." });
    }

    // Add the signature to the database
    const ownerSignature = generateSignature(
      { balance1, balance2, nonce, amount },
      principal1
    );
    await insertSignatures(
      client,
      channel.id,
      balance1,
      balance2,
      nonce,
      "withdraw",
      principal2,
      null,
      ownerSignature,
      signature
    );

    await client.query("COMMIT");
    res.status(200).json({ signature: ownerSignature });
  } catch (error) {
    console.error("Error handling withdraw:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleClose(req, res) {
  const {
    token,
    "principal-1": principal1,
    "principal-2": principal2,
    "balance-1": balance1,
    "balance-2": balance2,
    nonce,
    signature,
  } = req.body;

  try {
    const client = await pool.connect();
    await client.query("BEGIN");

    const channel = await getChannel(client, principal1, principal2, token);

    if (!channel) {
      return res.status(403).json({ error: "Channel does not exist." });
    }

    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      return res.status(409).json({ error: "Nonce conflict." });
    }

    // Validate the close action
    const isValid = verifySignature(
      signature,
      { balance1, balance2, nonce },
      principal2
    );

    if (!isValid) {
      return res.status(403).json({ error: "Invalid close signature." });
    }

    // Add the signature to the database
    const ownerSignature = generateSignature(
      { balance1, balance2, nonce },
      principal1
    );
    await insertSignatures(
      client,
      channel.id,
      balance1,
      balance2,
      nonce,
      "close",
      principal2,
      null,
      ownerSignature,
      signature
    );

    await client.query("COMMIT");
    res.status(200).json({ signature: ownerSignature });
  } catch (error) {
    console.error("Error handling close:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  handleTransfer,
  handleDeposit,
  handleWithdraw,
  handleClose,
};
