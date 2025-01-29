import React, { useState, useEffect } from "react";
import { AppConfig, UserSession, showConnect } from "@stacks/connect";
import axios from "axios";
import Modal from "react-modal";

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

  const handleAction = async (action, channel) => {
    if (!amount) return alert("Enter an amount");
    try {
      const payload = {
        amount: parseInt(amount),
        "principal-1": channel.principal_1,
        "principal-2": channel.principal_2,
        "balance-1": channel.balance_1,
        "balance-2": channel.balance_2,
        nonce: channel.nonce + 1,
        signature: "PLACEHOLDER_SIGNATURE", // This should be signed by the user
      };
      const endpoint = action === "transfer" ? "/transfer" : `/${action}`;

      await axios.post(`${API_BASE_URL}${endpoint}`, payload);
      alert(`${action} successful`);
      fetchChannels(user.profile.stxAddress.mainnet);
      setModal({ open: false });
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

function OwnerView({ channels, setModal }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mt-4">Your Open Channels</h2>
      <button className="bg-green-500 text-white p-2 rounded mt-2">
        Open New Channel
      </button>
      {channels.length === 0 ? (
        <p>No open channels</p>
      ) : (
        channels.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} setModal={setModal} />
        ))
      )}
    </div>
  );
}

function UserView({ channels, setModal }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mt-4">Your Channel</h2>
      {channels.length === 0 ? (
        <button className="bg-green-500 text-white p-2 rounded mt-2">
          Open Channel
        </button>
      ) : (
        channels.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} setModal={setModal} />
        ))
      )}
    </div>
  );
}

function ChannelCard({ channel, setModal }) {
  return (
    <div className="border p-4 mt-2 rounded">
      <p>
        <strong>Channel:</strong> {channel.principal_1} ↔ {channel.principal_2}
      </p>
      <p>
        <strong>Balance:</strong> {channel.balance_1} STX / {channel.balance_2}{" "}
        STX
      </p>
      <p>
        <strong>Nonce:</strong> {channel.nonce}
      </p>
      <div className="flex space-x-2 mt-2">
        <button
          className="bg-blue-500 text-white p-1 rounded"
          onClick={() => setModal({ open: true, type: "transfer", channel })}
        >
          Transfer
        </button>
        <button
          className="bg-green-500 text-white p-1 rounded"
          onClick={() => setModal({ open: true, type: "deposit", channel })}
        >
          Deposit
        </button>
        <button
          className="bg-yellow-500 text-white p-1 rounded"
          onClick={() => setModal({ open: true, type: "withdraw", channel })}
        >
          Withdraw
        </button>
        <button
          className="bg-red-500 text-white p-1 rounded"
          onClick={() => setModal({ open: true, type: "close", channel })}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default App;
