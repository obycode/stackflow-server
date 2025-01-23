const express = require("express");
const {
  handleFundChannelEvent,
  handleCloseChannelEvent,
  handleForceCancelEvent,
  handleForceCloseEvent,
  handleFinalizeEvent,
  handleDepositEvent,
  handleWithdrawEvent,
  handleDisputeClosureEvent,
} = require("../controllers/eventController");
const { requireAuth } = require("../utils/auth");

const router = express.Router();

// Add the requireAuth middleware to secure the routes
router.post("/fund-channel", requireAuth, handleFundChannelEvent);
router.post("/close-channel", requireAuth, handleCloseChannelEvent);
router.post("/force-cancel", requireAuth, handleForceCancelEvent);
router.post("/force-close", requireAuth, handleForceCloseEvent);
router.post("/finalize", requireAuth, handleFinalizeEvent);
router.post("/deposit", requireAuth, handleDepositEvent);
router.post("/withdraw", requireAuth, handleWithdrawEvent);
router.post("/dispute-closure", requireAuth, handleDisputeClosureEvent);

module.exports = router;
