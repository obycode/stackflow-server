const {
  CHANNEL_STATE,
  ACTION,
  OWNER,
  PRIVATE_KEY,
  NETWORK,
} = require("../utils/constants");
const pool = require("../utils/db");
const { verifySignature, generateSignature } = require("../utils/signature");
const {
  getChannel,
  getChannelsWith,
  insertSignatures,
  updateChannel,
} = require("../services/channelService");
const { identifyBalances } = require("../utils/common");

/// Handle POST /api/transfer
/// This function is responsible for handling a transfer to `OWNER` from a
/// channel participant. It will validate the transfer parameters and then
/// verify the signature. If the signature is valid, it will update the channel
/// state and return the owner's signature.
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

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const channel = await getChannel(client, principal1, principal2, token);
    if (!channel) {
      return res.status(404).json({ error: "Channel does not exist." });
    }

    const sender = principal1 === OWNER ? principal2 : principal1;

    // Check if the nonce is valid
    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      return res.status(409).json({ error: "Nonce conflict.", channel });
    }

    // We will only automatically sign off on an incoming transfer. The
    // new balances must be correct.
    const { myBalance, theirBalance, myPrevBalance, theirPrevBalance } =
      identifyBalances(principal1, OWNER, balance1, balance2, channel);

    if (
      myPrevBalance + BigInt(amount) !== myBalance ||
      theirPrevBalance - BigInt(amount) !== theirBalance
    ) {
      return res
        .status(409)
        .json({ error: "Invalid transfer balance.", channel });
    }

    const signatureBuffer = Buffer.from(signature, "hex");
    const hashedSecretBuffer = hashedSecret
      ? Buffer.from(hashedSecret, "hex")
      : null;

    // Validate the signature
    const isValid = verifySignature(
      signatureBuffer,
      sender,
      token,
      OWNER,
      sender,
      myBalance,
      theirBalance,
      nonce,
      ACTION.TRANSFER,
      sender,
      hashedSecretBuffer,
      NETWORK
    );

    if (!isValid) {
      return res.status(403).json({ error: "Invalid transfer signature." });
    }

    // Generate the owner signature
    const ownerSignature = generateSignature(
      PRIVATE_KEY,
      token,
      OWNER,
      sender,
      myBalance,
      theirBalance,
      nonce,
      ACTION.TRANSFER,
      sender,
      hashedSecretBuffer,
      NETWORK
    );
    const ownerSignatureString = ownerSignature.toString("hex");

    // Update the channel state
    await updateChannel(
      client,
      channel.id,
      balance1,
      balance2,
      nonce,
      null,
      CHANNEL_STATE.OPEN
    );

    if (nextHops && nextHop !== null) {
      // Logic to initiate the next transfer hop
      console.log("Initiating next hop for the transfer:", nextHop);

      if (!hashedSecret) {
        return res
          .status(400)
          .json({ error: "Hashed secret is required for transfer flow." });
      }

      // TODO: Trigger next-hop transfer logic here, including special case for the last hop.
      // Decrypt the `nextHops[nextHop]` to get the next hop's details.
      let nextHopChannel;

      // Add the pending signature to the database
      await insertPendingSignatures(
        client,
        channel.id,
        balance1,
        balance2,
        nonce,
        ACTION.TRANSFER,
        sender,
        hashedSecret,
        ownerSignatureString,
        signature.toString("hex"),
        nextHopChannel.id,
        nextHopChannel.nonce
      );
    } else {
      if (hashedSecret) {
        return res.status(400).json({
          error: "Cannot require a secret without any next hops data.",
        });
      }

      // Add the signature to the database
      await insertSignatures(
        client,
        channel.id,
        balance1,
        balance2,
        nonce,
        ACTION.TRANSFER,
        sender,
        null,
        ownerSignatureString,
        signature.toString("hex")
      );
    }

    await client.query("COMMIT");
    res.status(200).json({ signature: ownerSignatureString });
  } catch (error) {
    await client.query("ROLLBACK"); // Ensure rollback on failure
    console.error("Error handling transfer:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
}

/// Handle POST /api/deposit
/// This function is responsible for handling a deposit to a channel. It will
/// validate the deposit parameters and then verify the signature. If the
/// signature is valid, it will return a signature from the owner. The channel
/// state will be updated once the `deposit` function is successfully called.
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

  let client;
  try {
    client = await pool.connect();

    const channel = await getChannel(client, principal1, principal2, token);

    if (!channel) {
      return res.status(404).json({ error: "Channel does not exist." });
    }

    const sender = principal1 === OWNER ? principal2 : principal1;

    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      return res.status(409).json({ error: "Nonce conflict." });
    }

    // Verify that the deposit is valid
    const { myBalance, theirBalance, myPrevBalance, theirPrevBalance } =
      identifyBalances(principal1, OWNER, balance1, balance2, channel);
    if (
      myPrevBalance !== myBalance ||
      theirPrevBalance + BigInt(amount) !== theirBalance
    ) {
      return res
        .status(409)
        .json({ error: "Invalid deposit balance.", channel });
    }

    // Verify the deposit signature
    const signatureBuffer = Buffer.from(signature, "hex");
    const isValid = verifySignature(
      signatureBuffer,
      sender,
      token,
      OWNER,
      sender,
      myBalance,
      theirBalance,
      nonce,
      ACTION.DEPOSIT,
      sender,
      null,
      NETWORK
    );

    if (!isValid) {
      return res.status(403).json({ error: "Invalid deposit signature." });
    }

    // Respond with the owner's signature
    const ownerSignature = generateSignature(
      PRIVATE_KEY,
      token,
      OWNER,
      sender,
      myBalance,
      theirBalance,
      nonce,
      ACTION.DEPOSIT,
      sender,
      null,
      NETWORK
    );
    const ownerSignatureString = ownerSignature.toString("hex");

    res.status(200).json({ signature: ownerSignatureString });
  } catch (error) {
    console.error("Error handling deposit:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
}

/// Handle POST /api/withdraw
/// This function is responsible for handling a withdrawal from a channel. It
/// will validate the withdraw parameters and then verify the signature. If the
/// signature is valid, it will return a signature from the owner. The channel
/// state will be updated once the `withdraw` function is successfully called.
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

  let client;
  try {
    client = await pool.connect();

    const channel = await getChannel(client, principal1, principal2, token);

    if (!channel) {
      return res.status(404).json({ error: "Channel does not exist." });
    }

    const sender = principal1 === OWNER ? principal2 : principal1;

    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      return res.status(409).json({ error: "Nonce conflict." });
    }

    // Verify that the withdrawal is valid
    const { myBalance, theirBalance, myPrevBalance, theirPrevBalance } =
      identifyBalances(principal1, OWNER, balance1, balance2, channel);
    if (
      myPrevBalance !== myBalance ||
      theirPrevBalance - BigInt(amount) !== theirBalance
    ) {
      return res
        .status(409)
        .json({ error: "Invalid deposit balance.", channel });
    }

    // Verify the deposit signature
    const signatureBuffer = Buffer.from(signature, "hex");
    const isValid = verifySignature(
      signatureBuffer,
      sender,
      token,
      OWNER,
      sender,
      myBalance,
      theirBalance,
      nonce,
      ACTION.WITHDRAW,
      sender,
      null,
      NETWORK
    );

    if (!isValid) {
      return res.status(403).json({ error: "Invalid deposit signature." });
    }

    // Respond with the owner's signature
    const ownerSignature = generateSignature(
      PRIVATE_KEY,
      token,
      OWNER,
      sender,
      myBalance,
      theirBalance,
      nonce,
      ACTION.WITHDRAW,
      sender,
      null,
      NETWORK
    );
    const ownerSignatureString = ownerSignature.toString("hex");

    res.status(200).json({ signature: ownerSignatureString });
  } catch (error) {
    console.error("Error handling deposit:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
}

/// Handle POST /api/close
/// This function is responsible for handling the closure of a channel. It
/// will validate the balances and nonce and then verify the signature. If the
/// signature is valid, it will return a signature from the owner. The channel
/// state will be updated once the `close` function is successfully called.
async function handleClose(req, res) {
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

  let client;
  try {
    client = await pool.connect();

    const channel = await getChannel(client, principal1, principal2, token);

    if (!channel) {
      return res.status(404).json({ error: "Channel does not exist." });
    }

    const sender = principal1 === OWNER ? principal2 : principal1;

    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      return res.status(409).json({ error: "Nonce conflict." });
    }

    // Verify that the closure is valid
    const { myBalance, theirBalance, myPrevBalance, theirPrevBalance } =
      identifyBalances(principal1, OWNER, balance1, balance2, channel);
    if (myPrevBalance !== myBalance || theirPrevBalance !== theirBalance) {
      return res
        .status(409)
        .json({ error: "Invalid deposit balance.", channel });
    }

    // Verify the deposit signature
    const signatureBuffer = Buffer.from(signature, "hex");
    const isValid = verifySignature(
      signatureBuffer,
      sender,
      token,
      OWNER,
      sender,
      myBalance,
      theirBalance,
      nonce,
      ACTION.CLOSE,
      sender,
      null,
      NETWORK
    );

    if (!isValid) {
      return res.status(403).json({ error: "Invalid deposit signature." });
    }

    // Respond with the owner's signature
    const ownerSignature = generateSignature(
      PRIVATE_KEY,
      token,
      OWNER,
      sender,
      myBalance,
      theirBalance,
      nonce,
      ACTION.CLOSE,
      sender,
      null,
      NETWORK
    );
    const ownerSignatureString = ownerSignature.toString("hex");

    res.status(200).json({ signature: ownerSignatureString });
  } catch (error) {
    console.error("Error handling deposit:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
}

async function handleChannels(req, res) {
  const { principal } = req.query;

  let client;
  try {
    client = await pool.connect();

    const channels = await getChannelsWith(client, principal);

    res.status(200).json(channels);
  } catch (error) {
    console.error("Error fetching channels:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
}

module.exports = {
  handleTransfer,
  handleDeposit,
  handleWithdraw,
  handleClose,
  handleChannels,
};
