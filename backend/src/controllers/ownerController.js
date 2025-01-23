const { fetchChannels, addChannel } = require("../services/ownerService");

// Get all channels
exports.getChannels = async (req, res) => {
  try {
    const channels = await fetchChannels();
    res.status(200).json(channels);
  } catch (error) {
    console.error("Error fetching channels:", error);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
};

// Fund a new channel
exports.fundChannel = async (req, res) => {
  const {
    token,
    principal_1,
    principal_2,
    balance_1,
    balance_2,
    nonce,
    expires_at,
  } = req.body;
  try {
    const newChannel = await addChannel({
      token,
      principal_1,
      principal_2,
      balance_1,
      balance_2,
      nonce,
      expires_at,
    });
    res.status(201).json(newChannel);
  } catch (error) {
    console.error("Error funding channel:", error);
    res.status(500).json({ error: "Failed to fund channel" });
  }
};
