import React, { useState } from 'react';
import { X, Upload, Link as LinkIcon, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface ImportPlaylistModalProps {
  onClose: () => void;
  user: User | null;
}

const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({ onClose, user }) => {
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ total: number; current: number } | null>(null);

  const parseM3U = (content: string) => {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel: any = null;

    for (const line of lines) {
      if (line.trim() === '') continue;
      
      if (line.startsWith('#EXTINF:')) {
        currentChannel = {};
        const infoStr = line.substring(8);
        
        // Extract typical M3U tags
        const titleMatch = infoStr.split(',').pop();
        if (titleMatch) currentChannel.name = titleMatch.trim();

        const logoMatch = infoStr.match(/tvg-logo="([^"]+)"/);
        if (logoMatch) currentChannel.logo = logoMatch[1];
        
        const groupMatch = infoStr.match(/group-title="([^"]+)"/);
        if (groupMatch) {
          currentChannel.category = groupMatch[1];
        } else {
           currentChannel.category = 'IPTV';
        }
      } else if (!line.startsWith('#')) {
        if (currentChannel && line.trim().startsWith('http')) {
          currentChannel.url = line.trim();
          channels.push(currentChannel);
          currentChannel = null;
        }
      }
    }
    
    return channels;
  };

  const handleImportUrl = async () => {
    if (!playlistUrl) {
      setError('Please enter a valid playlist URL');
      return;
    }
    if (!user) {
      setError('You must be logged in to import playlists');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // First try directly, might fail due to CORS
      const response = await fetch(playlistUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch playlist (Status: ${response.status})`);
      }
      
      const content = await response.text();
      await processPlaylistContext(content);
    } catch (err: any) {
      console.error(err);
      setError(`Error fetching playlist: ${err.message}. If this is a CORS issue, try downloading the file and copy-pasting its contents, or finding a CORS-friendly URL.`);
      setLoading(false);
    }
  };

  const processPlaylistContext = async (content: string) => {
    if (!content.includes('#EXTM3U')) {
      setError('Invalid playlist format. Must be an M3U file.');
      setLoading(false);
      return;
    }

    const channels = parseM3U(content);
    if (channels.length === 0) {
      setError('No valid channels found in the playlist.');
      setLoading(false);
      return;
    }

    setProgress({ total: channels.length, current: 0 });

    let importedCount = 0;
    
    // Process in batches or one by one
    for (const channel of channels) {
      try {
        const validUrl = channel.url.startsWith('http') ? channel.url.substring(0, 1000) : `http://${channel.url.substring(0, 993)}`;
        await addDoc(collection(db, 'channels'), {
          name: (channel.name || 'Unknown Channel').substring(0, 100),
          url: validUrl,
          logo: (channel.logo || '').substring(0, 1000),
          category: (channel.category || 'IPTV').substring(0, 50),
          description: `Imported from playlist.`,
          ownerId: user!.uid,
          createdAt: serverTimestamp(),
        });
        importedCount++;
        setProgress({ total: channels.length, current: importedCount });
      } catch (e) {
        console.error("Error adding channel during import:", e);
      }
    }
    
    setSuccess(`Successfully imported ${importedCount} channels!`);
    setLoading(false);
    setProgress(null);
    
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setError('You must be logged in to import playlists');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (content) {
        await processPlaylistContext(content);
      } else {
        setError('Failed to read file.');
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Error reading file.');
      setLoading(false);
    }
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/50">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Upload className="w-5 h-5 text-red-500" />
            Import IPTV Playlist (M3U)
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-start gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg flex items-center gap-3 text-green-400 text-sm">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <p>{success}</p>
            </div>
          )}

          {!user && !error && !success && (
            <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg flex items-center gap-3 text-yellow-500 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>You must be logged in to import playlists.</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Import from URL</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    disabled={loading || !user}
                    placeholder="https://example.com/playlist.m3u"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-lg bg-zinc-950 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  />
                </div>
                <button
                  onClick={handleImportUrl}
                  disabled={loading || !user || !playlistUrl}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                >
                  Import
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-800"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-2 bg-zinc-900 text-xs text-gray-500 uppercase tracking-widest font-semibold">Or</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Upload M3U File</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-700 border-dashed rounded-lg hover:border-gray-500 transition-colors bg-zinc-950">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-10 w-10 text-gray-500" />
                  <div className="flex text-sm text-gray-400 justify-center">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-zinc-950 rounded-md font-medium text-red-500 hover:text-red-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-red-500">
                      <span>Upload a file</span>
                      <input 
                        id="file-upload" 
                        name="file-upload" 
                        type="file" 
                        accept=".m3u,.m3u8" 
                        className="sr-only" 
                        onChange={handleFileUpload}
                        disabled={loading || !user}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    M3U or M3U8 up to 10MB
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {loading && (
            <div className="py-4 text-center">
              <div className="w-full bg-gray-800 rounded-full h-2.5 mb-2 mt-4 overflow-hidden">
                <div 
                  className="bg-red-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress ? (progress.current / progress.total) * 100 : 10}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-400">
                {progress ? `Importing ${progress.current} of ${progress.total} channels...` : 'Processing playlist...'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportPlaylistModal;
