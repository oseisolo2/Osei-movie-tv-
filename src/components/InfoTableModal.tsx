import React from 'react';
import { X, Tv } from 'lucide-react';
import { Channel } from '../App'; // We might need to export Channel from App or define it here if not available.

// Since we cannot easily import Channel interface if it's not exported, we redefine it locally or just use any/partial.
interface ChannelInfo {
  id: string;
  name: string;
  category: string;
  url: string;
  description?: string;
}

interface InfoTableModalProps {
  onClose: () => void;
  channels: ChannelInfo[];
}

const InfoTableModal: React.FC<InfoTableModalProps> = ({ onClose, channels }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-gray-800 rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/50">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Tv className="w-5 h-5 text-red-500" />
            Information Table
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-0 overflow-y-auto custom-scrollbar flex-1 bg-zinc-950">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="text-xs text-gray-400 uppercase bg-zinc-900 sticky top-0 shadow-md">
              <tr>
                <th scope="col" className="px-6 py-4 border-b border-gray-800">Channel Name</th>
                <th scope="col" className="px-6 py-4 border-b border-gray-800">Category</th>
                <th scope="col" className="px-6 py-4 border-b border-gray-800 hidden md:table-cell">Description</th>
                <th scope="col" className="px-6 py-4 border-b border-gray-800 hidden lg:table-cell">Stream URL</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel, idx) => (
                <tr key={channel.id || idx} className="bg-zinc-950 border-b border-zinc-800 hover:bg-zinc-900 transition-colors">
                  <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                    {channel.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-zinc-800 text-gray-300 text-xs px-2 py-1 rounded-md border border-gray-700">
                      {channel.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell max-w-xs truncate">
                    {channel.description || 'No description available'}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell max-w-xs truncate text-xs font-mono text-gray-500">
                    {channel.url}
                  </td>
                </tr>
              ))}
              {channels.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">
                    No channels available in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-800 bg-black/50 flex justify-between items-center text-xs text-gray-500">
          <span>Total Channels: {channels.length}</span>
          <span>© {new Date().getFullYear()} Osei TV Database Info</span>
        </div>
      </div>
    </div>
  );
};

export default InfoTableModal;
