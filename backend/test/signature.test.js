const { createHash } = require("crypto");
const { expect } = require("chai");
const {
  generateSignature,
  verifySignature,
} = require("../src/utils/signature");
const {
  publicKeyToAddress,
  AddressVersion,
  privateKeyToPublic,
} = require("@stacks/transactions");
const { ACTION, NETWORK } = require("../src/utils/constants");
const { STACKS_MAINNET } = require("@stacks/network");

function sha256(data) {
  return createHash("sha256").update(data).digest();
}

describe("Signature Tests", () => {
  const privateKey =
    "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801";
  const publicKey = privateKeyToPublic(privateKey);
  const address = publicKeyToAddress(
    NETWORK == STACKS_MAINNET
      ? AddressVersion.MainnetSingleSig
      : AddressVersion.TestnetSingleSig,
    publicKey
  );

  const testData = {
    token: null,
    myPrincipal: address,
    theirPrincipal:
      NETWORK == STACKS_MAINNET
        ? "SP1691R3BDYFTGA0638KRB4CBRVFX7X1HF0FQSX5Z"
        : "STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6",
    myBalance: 1300000,
    theirBalance: 1700000,
    nonce: 1,
    action: ACTION.TRANSFER,
    actor: null,
    hashedSecret: null,
  };

  const hashedSecret = sha256(Buffer.from("top secret", "hex"));
  const testDataWithSecret = {
    token: null,
    myPrincipal: address,
    theirPrincipal:
      NETWORK == STACKS_MAINNET
        ? "SP1691R3BDYFTGA0638KRB4CBRVFX7X1HF0FQSX5Z"
        : "STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6",
    myBalance: 1300000,
    theirBalance: 1700000,
    nonce: 1,
    action: ACTION.TRANSFER,
    actor: null,
    hashedSecret,
  };

  it("should generate and verify a signature", async () => {
    const signature = await generateSignature(
      privateKey,
      testData.token,
      testData.myPrincipal,
      testData.theirPrincipal,
      testData.myBalance,
      testData.theirBalance,
      testData.nonce,
      testData.action,
      testData.actor,
      testData.hashedSecret,
      NETWORK
    );

    const isValid = await verifySignature(
      signature,
      address,
      testData.token,
      testData.myPrincipal,
      testData.theirPrincipal,
      testData.myBalance,
      testData.theirBalance,
      testData.nonce,
      testData.action,
      testData.actor,
      testData.hashedSecret,
      NETWORK
    );

    expect(isValid).to.be.true;
  });

  it("should fail to verify with an invalid signature", async () => {
    const signature = await generateSignature(
      privateKey,
      testData.token,
      testData.myPrincipal,
      testData.theirPrincipal,
      testData.myBalance,
      testData.theirBalance,
      testData.nonce,
      testData.action,
      testData.actor,
      testData.hashedSecret,
      NETWORK
    );

    // Tamper with the signature
    const invalidSignature = signature;
    invalidSignature[0] = 0;

    const isValid = await verifySignature(
      invalidSignature,
      address,
      testData.token,
      testData.myPrincipal,
      testData.theirPrincipal,
      testData.myBalance,
      testData.theirBalance,
      testData.nonce,
      testData.action,
      testData.actor,
      testData.hashedSecret,
      NETWORK
    );

    expect(isValid).to.be.false;
  });

  it("should fail to verify with mismatched public key", async () => {
    const signature = await generateSignature(
      privateKey,
      testData.token,
      testData.myPrincipal,
      testData.theirPrincipal,
      testData.myBalance,
      testData.theirBalance,
      testData.nonce,
      testData.action,
      testData.actor,
      testData.hashedSecret,
      NETWORK
    );

    const wrongAddress = "SP126XFZQ3ZHYM6Q6KAQZMMJSDY91A8BTT6AD08RV";

    const isValid = await verifySignature(
      signature,
      wrongAddress,
      testData.token,
      testData.myPrincipal,
      testData.theirPrincipal,
      testData.myBalance,
      testData.theirBalance,
      testData.nonce,
      testData.action,
      testData.actor,
      testData.hashedSecret,
      NETWORK
    );

    expect(isValid).to.be.false;
  });

  it("should generate and verify a signature with a secret", async () => {
    const signature = await generateSignature(
      privateKey,
      testDataWithSecret.token,
      testDataWithSecret.myPrincipal,
      testDataWithSecret.theirPrincipal,
      testDataWithSecret.myBalance,
      testDataWithSecret.theirBalance,
      testDataWithSecret.nonce,
      testDataWithSecret.action,
      testDataWithSecret.actor,
      testDataWithSecret.hashedSecret,
      NETWORK
    );

    const isValid = await verifySignature(
      signature,
      address,
      testDataWithSecret.token,
      testDataWithSecret.myPrincipal,
      testDataWithSecret.theirPrincipal,
      testDataWithSecret.myBalance,
      testDataWithSecret.theirBalance,
      testDataWithSecret.nonce,
      testDataWithSecret.action,
      testDataWithSecret.actor,
      testDataWithSecret.hashedSecret,
      NETWORK
    );

    expect(isValid).to.be.true;
  });

  it("should fail to verify with an invalid signature with a secret", async () => {
    const signature = await generateSignature(
      privateKey,
      testDataWithSecret.token,
      testDataWithSecret.myPrincipal,
      testDataWithSecret.theirPrincipal,
      testDataWithSecret.myBalance,
      testDataWithSecret.theirBalance,
      testDataWithSecret.nonce,
      testDataWithSecret.action,
      testDataWithSecret.actor,
      testDataWithSecret.hashedSecret,
      NETWORK
    );

    // Tamper with the signature
    const invalidSignature = signature;
    invalidSignature[0] = 0;

    const isValid = await verifySignature(
      invalidSignature,
      address,
      testDataWithSecret.token,
      testDataWithSecret.myPrincipal,
      testDataWithSecret.theirPrincipal,
      testDataWithSecret.myBalance,
      testDataWithSecret.theirBalance,
      testDataWithSecret.nonce,
      testDataWithSecret.action,
      testDataWithSecret.actor,
      testDataWithSecret.hashedSecret,
      NETWORK
    );

    expect(isValid).to.be.false;
  });

  it("should fail to verify with mismatched public key with a secret", async () => {
    const signature = await generateSignature(
      privateKey,
      testDataWithSecret.token,
      testDataWithSecret.myPrincipal,
      testDataWithSecret.theirPrincipal,
      testDataWithSecret.myBalance,
      testDataWithSecret.theirBalance,
      testDataWithSecret.nonce,
      testDataWithSecret.action,
      testDataWithSecret.actor,
      testDataWithSecret.hashedSecret,
      NETWORK
    );

    const wrongAddress = "SP126XFZQ3ZHYM6Q6KAQZMMJSDY91A8BTT6AD08RV";

    const isValid = await verifySignature(
      signature,
      wrongAddress,
      testDataWithSecret.token,
      testDataWithSecret.myPrincipal,
      testDataWithSecret.theirPrincipal,
      testDataWithSecret.myBalance,
      testDataWithSecret.theirBalance,
      testDataWithSecret.nonce,
      testDataWithSecret.action,
      testDataWithSecret.actor,
      testDataWithSecret.hashedSecret,
      NETWORK
    );

    expect(isValid).to.be.false;
  });
});
