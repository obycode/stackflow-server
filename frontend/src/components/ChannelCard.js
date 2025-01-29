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

export default ChannelCard;
