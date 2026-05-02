import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Tv } from 'lucide-react';
import { generateSchedule, getCurrentlyPlaying, getUpNext, Program } from './epg';

interface Channel {
  id: string;
  name: string;
  logo?: string;
}

interface EPGModalProps {
  channels: Channel[];
  onClose: () => void;
  onSelectChannel: (channel: Channel) => void;
  currentChannelId?: string;
}

const EPGModal: React.FC<EPGModalProps> = ({ channels, onClose, onSelectChannel, currentChannelId }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  // Filter channels to ones that we can show (e.g. active ones)
  const epgData = channels.map(c => ({
    ...c,
    schedule: generateSchedule(c.id, currentTime)
  }));
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };


  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 md:p-8 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-zinc-900 border border-gray-700 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-black sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter text-white">TV Guide</h2>
              <p className="text-gray-400 text-sm font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> {currentTime.toLocaleDateString()} {formatTime(currentTime)}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 hover:text-red-500 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* EPG Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-4">
            {epgData.map((channelData) => {
              const playingNow = getCurrentlyPlaying(channelData.schedule);
              const nextUp = getUpNext(channelData.schedule);
              const isActive = currentChannelId === channelData.id;
              
              return (
                <div 
                  key={channelData.id} 
                  className={`bg-black border ${isActive ? 'border-red-600' : 'border-gray-800 hover:border-gray-600'} rounded-xl p-4 flex flex-col md:flex-row gap-4 transition-colors cursor-pointer group`}
                  onClick={() => {
                    onSelectChannel(channelData);
                    onClose();
                  }}
                >
                  {/* Channel Info */}
                  <div className="w-full md:w-64 flex items-center gap-4 shrink-0 border-b md:border-b-0 md:border-r border-gray-800 pb-4 md:pb-0 md:pr-4">
                    <img 
                      src={channelData.logo || 'https://via.placeholder.com/100'} 
                      alt={channelData.name}
                      className="w-16 h-16 rounded-xl object-cover bg-zinc-800 shadow-md"
                    />
                    <div>
                      <h3 className={`font-bold text-lg ${isActive ? 'text-red-500' : 'text-gray-200 group-hover:text-white'}`}>
                        {channelData.name}
                      </h3>
                      {isActive && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded-full mt-1 border border-red-500/20"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Watching</span>}
                    </div>
                  </div>
                  
                  {/* Programs */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Now Playing */}
                    <div className="bg-zinc-800/50 rounded-lg p-3 border-l-2 border-red-600 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg tracking-wider">NOW</div>
                      <div className="text-xs text-gray-400 font-medium mb-1 drop-shadow-sm">
                        {playingNow ? `${formatTime(playingNow.startTime)} - ${formatTime(playingNow.endTime)}` : 'No Schedule'}
                      </div>
                      <h4 className="font-bold text-white mb-1 truncate">{playingNow ? playingNow.title : 'Off Air'}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{playingNow ? playingNow.description : 'Programming returns shortly.'}</p>
                    </div>
                    
                    {/* Up Next */}
                    <div className="bg-zinc-800/30 rounded-lg p-3 border-l-2 border-gray-600 opacity-80 group-hover:opacity-100 transition-opacity">
                      <div className="text-xs text-gray-500 font-medium mb-1">
                        {nextUp ? `Up Next • ${formatTime(nextUp.startTime)}` : 'Up Next'}
                      </div>
                      <h4 className="font-bold text-gray-300 mb-1 truncate">{nextUp ? nextUp.title : 'To Be Announced'}</h4>
                      <p className="text-xs text-gray-600 line-clamp-2">{nextUp ? nextUp.description : 'Check back later for updates.'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default EPGModal;
