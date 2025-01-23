const { STACKS_MAINNET, STACKS_TESTNET } = require("@stacks/network");
const { getAccountBalance } = require("@stacks/blockchain-api-client");

// Select network based on environment
const network =
  process.env.STACKS_NETWORK === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

/**
 * Fetch the balance of a given Stacks address.
 * @param {string} address - The Stacks address to query.
 * @returns {Promise<object>} - Object containing STX balance and token balances.
 */
async function getBalance(address) {
  try {
    const accountInfo = await getAccountBalance({
      principal: address,
    });

    return {
      stxBalance: accountInfo.stx.balance, // STX balance in micro-STX
      tokens: accountInfo.fungible_tokens, // SIP-010 tokens
    };
  } catch (error) {
    console.error(
      `Error fetching account balance for ${address}:`,
      error.message
    );
    throw new Error("Unable to fetch account balance.");
  }
}

/**
 * Fetch SIP-010 tokens held by the account.
 * @param {string} address - The Stacks address to query.
 * @returns {Promise<Array>} - Array of token objects.
 */
async function getTokens(address) {
  const { tokens } = await getBalance(address);

  // Transform tokens into a usable format
  const tokenDetails = Object.entries(tokens).map(
    ([contractAddress, details]) => ({
      contractAddress, // Full contract address
      name: details.name, // Token name
      symbol: details.symbol, // Token symbol
      balance: details.balance, // Token balance
    })
  );

  return tokenDetails;
}

/**
 * Get basic information about the account.
 * @param {string} address - The Stacks address to query.
 * @returns {Promise<object>} - Object containing STX balance and tokens.
 */
async function getAccountInfo(address) {
  const { stxBalance, tokens } = await getBalance(address);

  return {
    stxBalance, // STX balance in micro-STX
    tokens: Object.entries(tokens).map(([contractAddress, details]) => ({
      contractAddress,
      name: details.name,
      symbol: details.symbol,
      balance: details.balance,
    })),
  };
}

module.exports = {
  getBalance,
  getTokens,
  getAccountInfo,
};
