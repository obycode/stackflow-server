const {
  STACKS_MAINNET,
  STACKS_TESTNET,
  STACKS_MOCKNET,
  STACKS_DEVNET,
} = require("@stacks/network");

const CHANNEL_STATE = {
  OPEN: "open",
  CLOSED: "closed",
};

const ACTION = {
  CLOSE: 0,
  TRANSFER: 1,
  DEPOSIT: 2,
  WITHDRAW: 3,
};

const OWNER = process.env.OWNER_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const STACKFLOW_CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const STACKFLOW_CONTRACT_NAME = process.env.CONTRACT_NAME;

function getNetwork() {
  const networkName = process.env.STACKS_NETWORK;
  let network;
  switch (networkName) {
    case "mainnet":
      network = STACKS_MAINNET;
      break;
    case "testnet":
      network = STACKS_TESTNET;
      break;
    case "mocknet":
      network = STACKS_MOCKNET;
      break;
    case "devnet":
      network = STACKS_DEVNET;
      break;
    default:
      throw new Error(`Unknown network name: ${networkName}`);
  }

  if (process.env.CHAIN_ID) {
    network.chainId = process.env.CHAIN_ID;
  }

  if (process.env.API_URL) {
    network.client.baseUrl = process.env.API_URL;
  }

  return network;
}

const NETWORK = getNetwork();

module.exports = {
  CHANNEL_STATE,
  ACTION,
  OWNER,
  PRIVATE_KEY,
  STACKFLOW_CONTRACT_ADDRESS,
  STACKFLOW_CONTRACT_NAME,
  NETWORK,
};
