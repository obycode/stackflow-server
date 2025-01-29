function identifyBalances(principal1, owner, balance1, balance2, channel) {
  const isOwnerFirst = principal1 === owner;

  return {
    myBalance: BigInt(isOwnerFirst ? balance1 : balance2),
    theirBalance: BigInt(isOwnerFirst ? balance2 : balance1),
    myPrevBalance: BigInt(isOwnerFirst ? channel.balance_1 : channel.balance_2),
    theirPrevBalance: BigInt(
      isOwnerFirst ? channel.balance_2 : channel.balance_1
    ),
  };
}

module.exports = {
  identifyBalances,
};