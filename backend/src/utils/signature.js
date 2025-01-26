const { createHash } = require("crypto");
require("dotenv").config();
const {
  Cl,
  serializeCV,
  signWithKey,
  ClarityType,
  fetchCallReadOnlyFunction,
} = require("@stacks/transactions");
const {
  STACKFLOW_CONTRACT_ADDRESS,
  STACKFLOW_CONTRACT_NAME,
  OWNER,
} = require("./constants");

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

const structuredDataPrefix = Buffer.from([0x53, 0x49, 0x50, 0x30, 0x31, 0x38]);

function sha256(data) {
  return createHash("sha256").update(data).digest();
}

function structuredDataHash(structuredData) {
  return sha256(Buffer.from(serializeCV(structuredData)));
}

function domainHash(chainId) {
  return structuredDataHash(
    Cl.tuple({
      name: Cl.stringAscii("StackFlow"),
      version: Cl.stringAscii("0.2.2"),
      "chain-id": Cl.uint(chainId),
    })
  );
}

function signStructuredData(privateKey, structuredData, chainId) {
  const messageHash = structuredDataHash(structuredData);
  const input = sha256(
    Buffer.concat([structuredDataPrefix, domainHash(chainId), messageHash])
  );
  const data = signWithKey(privateKey, input.toString("hex"));
  return Buffer.from(data.slice(2) + data.slice(0, 2), "hex");
}

// Generate a signature for a message with these parameters.
// Note: if you have the secret, you can generate the `hashedSecret` by calling
// `sha256(Buffer.from(secret, "hex"))`
async function generateSignature(
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
    token === null
      ? Cl.none()
      : Cl.some(Cl.contractPrincipal(token[0], token[1]));
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

function generateSignatureNative(
  privateKey,
  token,
  myPrincipal,
  theirPrincipal,
  myBalance,
  theirBalance,
  nonce,
  action,
  actor = null,
  secret = null,
  network
) {
  const meFirst = myPrincipal < theirPrincipal;
  const principal1 = meFirst ? myPrincipal : theirPrincipal;
  const principal2 = meFirst ? theirPrincipal : myPrincipal;
  const balance1 = meFirst ? myBalance : theirBalance;
  const balance2 = meFirst ? theirBalance : myBalance;

  const tokenCV =
    token === null
      ? Cl.none()
      : Cl.some(Cl.contractPrincipal(token[0], token[1]));
  const actorCV = actor === null ? Cl.none() : Cl.some(Cl.principal(actor));
  const secretCV =
    secret === null
      ? Cl.none()
      : Cl.some(Cl.buffer(sha256(Buffer.from(secret, "hex"))));

  const data = Cl.tuple({
    token: tokenCV,
    "principal-1": Cl.principal(principal1),
    "principal-2": Cl.principal(principal2),
    "balance-1": Cl.uint(balance1),
    "balance-2": Cl.uint(balance2),
    nonce: Cl.uint(nonce),
    action: Cl.uint(action),
    actor: actorCV,
    "hashed-secret": secretCV,
  });
  return signStructuredData(privateKey, data, network.chainId);
}

module.exports = {
  verifySignature,
  generateSignature,
};
