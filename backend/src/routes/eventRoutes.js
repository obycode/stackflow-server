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

const router = express.Router();

router.post("/fund-channel", handleFundChannelEvent);
router.post("/close-channel", handleCloseChannelEvent);
router.post("/force-cancel", handleForceCancelEvent);
router.post("/force-close", handleForceCloseEvent);
router.post("finalize", handleFinalizeEvent);
router.post("/deposit", handleDepositEvent);
router.post("/withdraw", handleWithdrawEvent);
router.post("/dispute-closure", handleDisputeClosureEvent);

module.exports = router;
