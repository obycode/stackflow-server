import ChannelCard from "./ChannelCard";

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

export default OwnerView;
