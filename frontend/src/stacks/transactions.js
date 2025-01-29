import { getUserSession, openContractCall, showConnect } from "@stacks/connect";
import { STACKS_MAINNET } from "@stacks/network";
import { Cl, PostConditionMode, Pc } from "@stacks/transactions";

// Update this with your actual contract address and name
const CONTRACT_ADDRESS = "SP126XFZQ3ZHYM6Q6KAQZMMJSDY91A8BTT6AD08RV";
const CONTRACT_NAME = "stackflow-0-2-2";
const OWNER = "SP1691R3BDYFTGA0638KRB4CBRVFX7X1HF0FQSX5Z";

// Set correct network
const network = STACKS_MAINNET;

// Function to trigger "Open Channel" contract call
export function openFundChannelTx() {
  const session = getUserSession();

  if (!session.isUserSignedIn()) {
    alert("Please connect your wallet first.");
    showConnect(); // Prompt user to sign in if they're not
    return;
  }

  const userAddress = session.loadUserData().profile.stxAddress.mainnet;

  const amount = prompt("Enter amount to fund the channel:"); // Ask user for amount

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    alert("Invalid amount");
    return;
  }

  openContractCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "fund-channel",
    functionArgs: [Cl.none(), Cl.uint(amount), Cl.principal(OWNER), Cl.uint(0)],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      Pc.principal(userAddress).willSendEq(amount).ustx(),
    ],
    network,
    appDetails: {
      name: "Stackflow",
      icon: window.location.origin + "/favicon.ico",
    },
    onFinish: (data) => {
      console.log("Transaction submitted:", data);
      alert("Channel funding transaction submitted!");
      window.location.reload(); // Refresh to fetch new channels
    },
    onCancel: () => {
      console.log("User canceled transaction");
    },
  });
}
