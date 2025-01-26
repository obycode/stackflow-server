const { verifySecret } = require("../utils/auth");
const { CHANNEL_STATE, ACTION, OWNER } = require("../utils/constants");
const pool = require("../utils/db");
const {
  getChannel,
  insertChannel,
  updateChannel,
  getSignatures,
  insertSignatures,
} = require("../services/channelService");

const EVENTS = {
  FUND_CHANNEL: "fund-channel",
  CLOSE_CHANNEL: "close-channel",
  FORCE_CANCEL: "force-cancel",
  FORCE_CLOSE: "force-close",
  FINALIZE: "finalize",
  DEPOSIT: "deposit",
  WITHDRAW: "withdraw",
  DISPUTE_CLOSURE: "dispute-closure",
};

/**
 * Generic Event Processor.
 */
async function processEvent(req, res, eventType, processor) {
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
            event.data?.value?.event === eventType
          ) {
            const {
              "channel-key": {
                "principal-1": principal1,
                "principal-2": principal2,
              },
            } = event.data.value;

            // If this channel doesn't involve the owner, we can ignore it
            if (principal1 !== OWNER && principal2 !== OWNER) {
              console.info(`Ignoring fund-channel event not involving owner.`);
              continue; // Skip further processing for this event
            }

            await processor(client, event.data.value);
          }
        }
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ message: "Event processed successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`Error processing ${eventType} event:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
}

/**
 * Handle fund-channel chainhook events.
 * @param {Request} req
 * @param {Response} res
 */
async function handleFundChannel(client, data) {
  console.info("fund-channel event:", data);
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
  } = data;

  let channel = await getChannel(client, principal1, principal2, token);

  if (channel) {
    const isSender1 = sender === principal1;

    // Check if the sender's balance is already non-zero
    if (
      (isSender1 && channel.balance_1 > 0) ||
      (!isSender1 && channel.balance_2 > 0)
    ) {
      console.warn(`fund-channel event for an already funded channel.`);
      return; // Skip further processing for this event
    }

    // Update the balance of the sender
    await updateChannel(
      client,
      channel.id,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.OPEN
    );
    console.info(`Channel updated successfully`);
  } else {
    // Insert a new channel if it doesn't exist
    await insertChannel(
      client,
      principal1,
      principal2,
      token,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.OPEN
    );
    console.info(`New channel created successfully`);
  }
}

const handleFundChannelEvent = (req, res) =>
  processEvent(req, res, EVENTS.FUND_CHANNEL, handleFundChannel);

async function handleCloseChannel(client, data) {
  console.info("close-channel event:", data);
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
  } = data;

  let channel = await getChannel(client, principal1, principal2, token);

  if (channel) {
    // Check if the channel is currently open
    if (channel.state !== CHANNEL_STATE.OPEN) {
      console.warn(
        `close-channel event for a channel in state ${channel.state}.`
      );
      return; // Skip further processing for this event
    }

    await updateChannel(
      client,
      channel.id,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.CLOSED
    );
    console.info(`Channel updated successfully`);
  } else {
    // Insert a new channel if it doesn't exist
    await insertChannel(
      client,
      principal1,
      principal2,
      token,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.CLOSED
    );
    console.warn(`New channel created for close event`);
  }
}

const handleCloseChannelEvent = (req, res) =>
  processEvent(req, res, EVENTS.CLOSE_CHANNEL, handleCloseChannel);

async function handleForceCancel(client, data) {
  console.info("force-cancel event:", data);
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
  } = data;

  // If the sender is the owner, then there is nothing to do
  if (sender === OWNER) {
    console.info(`Ignoring force-cancel event from the owner.`);
    return; // Skip further processing for this event
  }

  let channel = await getChannel(client, principal1, principal2, token);
  if (channel) {
    // Check if the channel is currently open
    if (channel.state !== CHANNEL_STATE.OPEN) {
      console.warn(
        `force-cancel event for a channel in state ${channel.state}.`
      );
      return; // Skip further processing for this event
    }

    // Retrieve the saved signatures we have for the channel
    const signatures = await getSignatures(client, channel.id);

    // If we have signatures, submit a call to `dispute-closure`
    if (signatures) {
      // If our balance is higher than the cancellation balance, we can dispute
      const cancelBalance = OWNER === principal1 ? balance1 : balance2;
      const signatureBalance =
        OWNER === principal1 ? signatures.balance_1 : signatures.balance_2;

      if (BigInt(signatureBalance) > BigInt(cancelBalance)) {
        // Submit a call to the contract to dispute the closure
        console.info(`Disputing channel closure`);

        // TODO: make call to `dispute-closure`
      }
    }
  } else {
    // Insert a new channel if it doesn't exist
    await insertChannel(
      client,
      principal1,
      principal2,
      token,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.OPEN
    );
    console.warn(`New channel created for force-cancel event`);
  }
}

const handleForceCancelEvent = (req, res) =>
  processEvent(req, res, EVENTS.FORCE_CANCEL, handleForceCancel);

async function handleForceClose(client, data) {
  console.info("force-close event:", data);
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
  } = data;

  // If the sender is the owner, then there is nothing to do
  if (sender === OWNER) {
    console.info(`Ignoring force-close event from the owner.`);
    return; // Skip further processing for this event
  }

  const channel = await getChannel(client, principal1, principal2, token);

  if (channel) {
    // Check if the channel is currently open
    if (channel.state !== CHANNEL_STATE.OPEN) {
      console.warn(
        `force-cancel event for a channel in state ${channel.state}.`
      );
      return; // Skip further processing for this event
    }

    const signatures = await getSignatures(client, channel.id);

    // If we have signatures, submit a call to `dispute-closure`
    if (signatures) {
      // If our balance is higher than the cancellation balance, we can dispute
      const cancelBalance = OWNER === principal1 ? balance1 : balance2;
      const signatureBalance =
        OWNER === principal1 ? signatures.balance_1 : signatures.balance_2;

      if (BigInt(signatureBalance) > BigInt(cancelBalance)) {
        // Submit a call to the contract to dispute the closure
        console.info(`Disputing channel closure`);

        // TODO: make call to `dispute-closure`
      }
    }
  } else {
    // Insert a new channel if it doesn't exist
    await insertChannel(
      client,
      principal1,
      principal2,
      token,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.OPEN
    );
    console.warn(`New channel created for force-close event`);
  }
}

const handleForceCloseEvent = (req, res) =>
  processEvent(req, res, EVENTS.FORCE_CLOSE, handleForceClose);

async function handleFinalize(client, data) {
  console.info("finalize event:", data);
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
  } = data;

  let channel = await getChannel(client, principal1, principal2, token);

  if (channel) {
    // Check if the channel is currently open
    if (channel.state !== CHANNEL_STATE.OPEN) {
      console.warn(`finalize event for a channel in state ${channel.state}.`);
      return; // Skip further processing for this event
    }

    // Update the state of the channel
    await updateChannel(
      client,
      channel.id,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.CLOSED
    );
    console.info(`Channel updated successfully`);
  } else {
    // Insert a new channel if it doesn't exist
    await insertChannel(
      client,
      principal1,
      principal2,
      token,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.CLOSED
    );
    console.warn(`New channel created for finalize event`);
  }
}

const handleFinalizeEvent = (req, res) =>
  processEvent(req, res, EVENTS.FINALIZE, handleFinalize);

async function handleDeposit(client, data) {
  console.info("deposit event:", data);
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
    "my-signature": mySignature,
    "their-signature": theirSignature,
  } = data;

  let channelId;

  // Check if the channel exists
  const channel = await getChannel(client, principal1, principal2, token);

  if (channel) {
    channelId = channel.id;

    // Check if the channel is currently open
    if (channel.state !== CHANNEL_STATE.OPEN) {
      console.warn(`deposit event for a channel in state ${channel.state}.`);
      return; // Skip further processing for this event
    }

    // If our nonce is already higher, we can ignore this event
    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      console.warn(`Ignoring deposit event with old nonce.`);
      return; // Skip further processing for this event
    }

    // Update the state of the channel
    await updateChannel(
      client,
      channelId,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.OPEN
    );
    console.info(`Channel updated successfully`);
  } else {
    // Insert a new channel if it doesn't exist
    channelId = await insertChannel(
      client,
      principal1,
      principal2,
      token,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.OPEN
    );
    console.warn(`New channel created for deposit event`);
  }

  let ownerSignature = mySignature;
  let otherSignature = theirSignature;
  if (sender !== OWNER) {
    ownerSignature = theirSignature;
    otherSignature = mySignature;
  }

  // Save the signatures for the channel
  await insertSignatures(
    client,
    channelId,
    balance1,
    balance2,
    nonce,
    ACTION.DEPOSIT,
    sender,
    null,
    ownerSignature,
    otherSignature
  );
}

const handleDepositEvent = (req, res) =>
  processEvent(req, res, EVENTS.DEPOSIT, handleDeposit);

async function handleWithdraw(client, data) {
  console.info("withdraw event:", data);
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
    "my-signature": mySignature,
    "their-signature": theirSignature,
  } = data;

  let channelId;

  // Check if the channel exists
  let channel = await getChannel(client, principal1, principal2, token);
  if (channel) {
    channelId = channel.id;

    // Check if the channel is currently open
    if (channel.state !== CHANNEL_STATE.OPEN) {
      console.warn(`withdraw event for a channel in state ${channel.state}.`);
      return; // Skip further processing for this event
    }

    // If our nonce is already higher, we can ignore this event
    if (BigInt(nonce) <= BigInt(channel.nonce)) {
      console.warn(`Ignoring withdraw event with old nonce.`);
      return; // Skip further processing for this event
    }

    // Update the state of the channel
    await updateChannel(
      client,
      channelId,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.OPEN
    );
    console.info(`Channel updated successfully`);
  } else {
    // Insert a new channel if it doesn't exist
    channelId = await insertChannel(
      client,
      principal1,
      principal2,
      token,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.OPEN
    );
    console.warn(`New channel created for withdraw event`);
  }

  let ownerSignature = mySignature;
  let otherSignature = theirSignature;
  if (sender !== OWNER) {
    ownerSignature = theirSignature;
    otherSignature = mySignature;
  }

  // Save the signatures for the channel
  await insertSignatures(
    client,
    channelId,
    balance1,
    balance2,
    nonce,
    ACTION.WITHDRAW,
    sender,
    null,
    ownerSignature,
    otherSignature
  );
}

const handleWithdrawEvent = (req, res) =>
  processEvent(req, res, EVENTS.WITHDRAW, handleWithdraw);

async function handleDisputeClosure(client, data) {
  console.info("dispute-closure event:", data);
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
  } = data;

  // Check if the channel exists
  let channel = await getChannel(client, principal1, principal2, token);

  if (channel) {
    // Check if the channel is currently open
    if (channel.state !== CHANNEL_STATE.OPEN) {
      console.warn(
        `dispute-closure event for a channel in state ${channel.state}.`
      );
      return; // Skip further processing for this event
    }

    // Update the state of the channel
    await updateChannel(
      client,
      channel.id,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.CLOSED
    );
    console.info(`Channel updated successfully`);
  } else {
    // Insert a new channel if it doesn't exist
    await insertChannel(
      client,
      principal1,
      principal2,
      token,
      balance1,
      balance2,
      nonce,
      expiresAt,
      CHANNEL_STATE.CLOSED
    );
    console.warn(`New channel created for dispute-closure event`);
  }
}

const handleDisputeClosureEvent = (req, res) =>
  processEvent(req, res, EVENTS.DISPUTE_CLOSURE, handleDisputeClosure);

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
