const express = require("express");
const {
  handleTransfer,
  handleDeposit,
  handleWithdraw,
  handleClose,
  handleChannels,
} = require("../controllers/apiController");

const router = express.Router();

router.post("/transfer", handleTransfer);
router.post("/deposit", handleDeposit);
router.post("/withdraw", handleWithdraw);
router.post("/close", handleClose);
router.get("/channels", handleChannels);

module.exports = router;
