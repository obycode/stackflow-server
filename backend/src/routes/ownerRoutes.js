const express = require("express");
const { getChannels, fundChannel } = require("../controllers/ownerController");

const router = express.Router();

// Get all channels
router.get("/channels", getChannels);

// Fund a new channel
router.post("/fund-channel", fundChannel);

module.exports = router;
