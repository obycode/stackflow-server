import { openFundChannelTx } from "../stacks/transactions";
import ChannelCard from "./ChannelCard";

function UserView({ channels, setModal }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mt-4">Your Channel</h2>
      {channels.length === 0 ? (
        <button
          className="bg-green-500 text-white p-2 rounded mt-2"
          onClick={openFundChannelTx} // Call function on click
        >
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

export default UserView;
