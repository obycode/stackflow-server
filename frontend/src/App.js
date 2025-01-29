import React, { useState, useEffect } from "react";
import {
  AppConfig,
  UserSession,
  openStructuredDataSignatureRequestPopup,
  showConnect,
} from "@stacks/connect";
import { Cl } from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import axios from "axios";
import Modal from "react-modal";
import UserView from "./components/UserView";
import OwnerView from "./components/OwnerView";

const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });

const OWNER = "SP1691R3BDYFTGA0638KRB4CBRVFX7X1HF0FQSX5Z"; // Replace with the actual owner address
const API_BASE_URL = "http://localhost:8888/api";

function App() {
  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [modal, setModal] = useState({ open: false, type: "", channel: null });
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      setUser(userSession.loadUserData());
      fetchChannels(userSession.loadUserData().profile.stxAddress.mainnet);
    }
  }, []);

  const authenticate = () => {
    showConnect({
      appDetails: {
        name: "StackFlow",
        icon: window.location.origin + "/logo.png",
      },
      userSession,
      onFinish: () => {
        setUser(userSession.loadUserData());
        fetchChannels(userSession.loadUserData().profile.stxAddress.mainnet);
      },
    });
  };

  const signOut = () => {
    userSession.signUserOut("/");
    setUser(null);
  };

  const fetchChannels = async (address) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/channels?principal=${address}`
      );
      setChannels(res.data);
    } catch (err) {
      console.error("Error fetching channels:", err);
    }
  };

  const adjustBalances = (channel, action) => {
    const { balance_1, balance_2 } = channel;
    const sender = userSession.loadUserData().profile.stxAddress.mainnet;
    const senderFirst = channel.principal_1 === sender;
    const amountInt = parseInt(amount);

    const balanceAdjustments = {
      deposit: [amountInt, 0],
      withdraw: [0, -amountInt],
      transfer: [-amountInt, amountInt],
    };

    if (!balanceAdjustments[action]) {
      throw new Error("Invalid action type");
    }

    const [adjust1, adjust2] = senderFirst
      ? balanceAdjustments[action]
      : balanceAdjustments[action].reverse();

    return {
      balance_1: parseInt(balance_1) + adjust1,
      balance_2: parseInt(balance_2) + adjust2,
    };
  };

  const domain = Cl.tuple({
    name: Cl.stringAscii("StackFlow"),
    version: Cl.stringAscii("0.2.2"),
    "chain-id": Cl.uint(STACKS_MAINNET.chainId),
  });

  const actionMap = {
    close: 0,
    transfer: 1,
    deposit: 2,
    withdraw: 3,
  };

  const buildMessage = (action, channel) => {
    const { balance_1, balance_2 } = adjustBalances(channel, action);

    const tokenCV =
      channel.token === null
        ? Cl.none()
        : (() => {
            const [contractAddress, contractName] = channel.token.split(".");
            return Cl.some(Cl.contractPrincipal(contractAddress, contractName));
          })();
    const actorCV = Cl.some(Cl.principal(user.profile.stxAddress.mainnet));
    const hashedSecretCV = Cl.none(); // TODO: handle secrets

    const message = Cl.tuple({
      token: tokenCV,
      "principal-1": Cl.principal(channel.principal_1),
      "principal-2": Cl.principal(channel.principal_2),
      "balance-1": Cl.uint(balance_1),
      "balance-2": Cl.uint(balance_2),
      nonce: Cl.uint(channel.nonce),
      action: Cl.uint(actionMap[action]),
      actor: actorCV,
      "hashed-secret": hashedSecretCV,
    });

    return message;
  };

  const handleAction = async (action, channel) => {
    if (!amount) return alert("Enter an amount");
    try {
      const payload = {
        amount: parseInt(amount),
        "principal-1": channel.principal_1,
        "principal-2": channel.principal_2,
        nonce: parseInt(channel.nonce) + 1,
      };
      const { balance_1, balance_2 } = adjustBalances(channel, action);
      payload["balance-1"] = balance_1;
      payload["balance-2"] = balance_2;

      const signOptions = {
        message: buildMessage(action, channel),
        domain,
        network: STACKS_MAINNET,
        onFinish: async (signature) => {
          payload.signature = signature.signature;
          await axios.post(`${API_BASE_URL}/${action}`, payload);
          alert(`${action} successful`);
          fetchChannels(user.profile.stxAddress.mainnet);
          setModal({ open: false });
        },
      };
      openStructuredDataSignatureRequestPopup(signOptions);
    } catch (err) {
      console.error(`Error processing ${action}:`, err);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">StackFlow Payment Channels</h1>

      {!user ? (
        <button
          className="bg-blue-500 text-white p-2 rounded"
          onClick={authenticate}
        >
          Connect Wallet
        </button>
      ) : (
        <div>
          <div className="flex justify-between items-center">
            <p>Connected as: {user.profile.stxAddress.mainnet}</p>
            <button className="text-red-500" onClick={signOut}>
              Sign Out
            </button>
          </div>

          {user.profile.stxAddress.mainnet === OWNER ? (
            <OwnerView channels={channels} setModal={setModal} />
          ) : (
            <UserView channels={channels} setModal={setModal} />
          )}
        </div>
      )}

      {/* Modal for transfer, deposit, withdraw */}
      {modal.open && (
        <Modal
          isOpen={modal.open}
          onRequestClose={() => setModal({ open: false })}
        >
          <div className="p-4">
            <h2 className="text-xl">{modal.type} Channel</h2>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border p-2 w-full mt-2"
              placeholder="Enter amount"
            />
            <div className="flex justify-end mt-4">
              <button
                className="bg-blue-500 text-white p-2 rounded mr-2"
                onClick={() => handleAction(modal.type, modal.channel)}
              >
                Confirm
              </button>
              <button
                className="text-gray-500"
                onClick={() => setModal({ open: false })}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;
