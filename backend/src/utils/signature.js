require("dotenv").config();
const {
  Cl,
  signWithKey,
  ClarityType,
  fetchCallReadOnlyFunction,
  signStructuredData,
} = require("@stacks/transactions");
const {
  STACKFLOW_CONTRACT_ADDRESS,
  STACKFLOW_CONTRACT_NAME,
  OWNER,
  STACKS_API_KEY,
} = require("./constants");
const { setFetchOptions } = require("@stacks/common");

// Verify a signature for a message with these parameters.
// Note: if you have the secret, you can generate the `hashedSecret` by calling
// `sha256(Buffer.from(secret, "hex"))`
async function verifySignature(
  signatureBuffer,
  signer,
  token,
  myPrincipal,
  theirPrincipal,
  myBalance,
  theirBalance,
  nonce,
  action,
  actor = null,
  hashedSecret = null,
  network
) {
  const meFirst = myPrincipal < theirPrincipal;
  const principal1 = meFirst ? myPrincipal : theirPrincipal;
  const principal2 = meFirst ? theirPrincipal : myPrincipal;
  const balance1 = meFirst ? myBalance : theirBalance;
  const balance2 = meFirst ? theirBalance : myBalance;

  // Setup API key middleware
  setFetchOptions({
    headers: {
      "x-api-key": STACKS_API_KEY,
    },
  });

  // Make a call to the read-only function, `verify-signature`, on the contract
  const options = {
    contractAddress: STACKFLOW_CONTRACT_ADDRESS,
    contractName: STACKFLOW_CONTRACT_NAME,
    functionName: "verify-signature",
    functionArgs: [
      Cl.buffer(signatureBuffer),
      Cl.principal(signer),
      Cl.tuple({
        token: token
          ? Cl.some(Cl.contractPrincipal(token[0], token[1]))
          : Cl.none(),
        "principal-1": Cl.principal(principal1),
        "principal-2": Cl.principal(principal2),
      }),
      Cl.uint(balance1),
      Cl.uint(balance2),
      Cl.uint(nonce),
      Cl.uint(action),
      actor ? Cl.some(Cl.principal(actor)) : Cl.none(),
      hashedSecret ? Cl.some(Cl.buffer(hashedSecret)) : Cl.none(),
    ],
    network,
    senderAddress: OWNER,
  };

  const result = await fetchCallReadOnlyFunction(options);
  return result.type === ClarityType.BoolTrue;
}

// Generate a signature for a message with these parameters by calling the
// `make-structured-data-hash` read-only function on the contract.
// Note: if you have the secret, you can generate the `hashedSecret` by calling
// `sha256(Buffer.from(secret, "hex"))`
async function generateSignatureContract(
  privateKey,
  token,
  myPrincipal,
  theirPrincipal,
  myBalance,
  theirBalance,
  nonce,
  action,
  actor = null,
  hashedSecret = null,
  network
) {
  const meFirst = myPrincipal < theirPrincipal;
  const principal1 = meFirst ? myPrincipal : theirPrincipal;
  const principal2 = meFirst ? theirPrincipal : myPrincipal;
  const balance1 = meFirst ? myBalance : theirBalance;
  const balance2 = meFirst ? theirBalance : myBalance;

  const tokenCV =
    token == null
      ? Cl.none()
      : (() => {
          const [contractAddress, contractName] = token.split(".");
          return Cl.some(Cl.contractPrincipal(contractAddress, contractName));
        })();
  const actorCV = actor === null ? Cl.none() : Cl.some(Cl.principal(actor));
  const hashedSecretCV = hashedSecret
    ? Cl.some(Cl.buffer(hashedSecret))
    : Cl.none();

  // Make a call to the read-only function, `make-structured-data-hash`, on the contract
  const options = {
    contractAddress: STACKFLOW_CONTRACT_ADDRESS,
    contractName: STACKFLOW_CONTRACT_NAME,
    functionName: "make-structured-data-hash",
    functionArgs: [
      Cl.tuple({
        token: tokenCV,
        "principal-1": Cl.principal(principal1),
        "principal-2": Cl.principal(principal2),
      }),
      Cl.uint(balance1),
      Cl.uint(balance2),
      Cl.uint(nonce),
      Cl.uint(action),
      actorCV,
      hashedSecretCV,
    ],
    network,
    senderAddress: OWNER,
  };

  const result = await fetchCallReadOnlyFunction(options);
  if (result.type !== ClarityType.ResponseOk) {
    throw new Error("Error generating structured data hash");
  }

  const hash = result.value;
  const signature = signWithKey(privateKey, hash.value.toString("hex"));
  return Buffer.from(signature.slice(2) + signature.slice(0, 2), "hex");
}

// Generate a signature for a message with these parameters using stacks.js.
// Note: if you have the secret, you can generate the `hashedSecret` by calling
// `sha256(Buffer.from(secret, "hex"))`
function generateSignature(
  privateKey,
  token,
  myPrincipal,
  theirPrincipal,
  myBalance,
  theirBalance,
  nonce,
  action,
  actor = null,
  hashedSecret = null,
  network
) {
  const meFirst = myPrincipal < theirPrincipal;
  const principal1 = meFirst ? myPrincipal : theirPrincipal;
  const principal2 = meFirst ? theirPrincipal : myPrincipal;
  const balance1 = meFirst ? myBalance : theirBalance;
  const balance2 = meFirst ? theirBalance : myBalance;

  const tokenCV =
    token == null
      ? Cl.none()
      : (() => {
          const [contractAddress, contractName] = token.split(".");
          return Cl.some(Cl.contractPrincipal(contractAddress, contractName));
        })();
  const actorCV = actor === null ? Cl.none() : Cl.some(Cl.principal(actor));
  const hashedSecretCV = hashedSecret
    ? Cl.some(Cl.buffer(hashedSecret))
    : Cl.none();

  const message = Cl.tuple({
    token: tokenCV,
    "principal-1": Cl.principal(principal1),
    "principal-2": Cl.principal(principal2),
    "balance-1": Cl.uint(balance1),
    "balance-2": Cl.uint(balance2),
    nonce: Cl.uint(nonce),
    action: Cl.uint(action),
    actor: actorCV,
    "hashed-secret": hashedSecretCV,
  });

  let domain = Cl.tuple({
    name: Cl.stringAscii("StackFlow"),
    version: Cl.stringAscii("0.2.2"),
    "chain-id": Cl.uint(network.chainId),
  });

  let signature = signStructuredData({ message, domain, privateKey });
  return Buffer.from(signature, "hex");
}

module.exports = {
  verifySignature,
  generateSignature,
};
