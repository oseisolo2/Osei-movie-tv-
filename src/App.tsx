import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth } from './lib/firebase';
import Hls from 'hls.js';
import { Tv, PlayCircle, ListVideo, Star, LogIn, LogOut, User as UserIcon, Settings, X } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  logo: string;
  category: string;
  url: string;
  description?: string;
}

interface UserProfile {
  displayName?: string;
  favoriteChannels: string[];
  settings: {
    autoPlayNext: boolean;
  };
}

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', logo: '', category: '', url: '', description: '' });
  const [adding, setAdding] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Quality options state
  const [qualities, setQualities] = useState<any[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const log = (msg: string) => {
    setDebugLogs(prev => [...prev, `> ${msg}`]);
    console.log(msg);
  };

  const toggleFavorite = async (e: import('react').MouseEvent, channel: Channel) => {
    e.stopPropagation();
    if (!user || !userProfile) {
      alert("Please login to favorite channels.");
      return;
    }
    try {
      const userRef = doc(db, 'users', user.uid);
      const isFav = userProfile.favoriteChannels.includes(channel.id);
      
      await updateDoc(userRef, {
        favoriteChannels: isFav ? arrayRemove(channel.id) : arrayUnion(channel.id)
      });
      log(`Toggled favorite for ${channel.name}`);
    } catch (err: any) {
      log(`Failed to update favorite: ${err.message}`);
      alert(`Failed to update favorite: ${err.message}`);
    }
  };

  const handleAddChannel = async (e: import('react').FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please login to add a new channel.");
      return;
    }
    if (!newChannel.name || !newChannel.url) {
      alert('Name and URL are required');
      return;
    }
    setAdding(true);
    try {
      const { addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, 'channels'), newChannel);
      setNewChannel({ name: '', logo: '', category: '', url: '', description: '' });
      setShowAddForm(false);
      log(`Successfully added channel: ${newChannel.name}`);
    } catch (err: any) {
      log(`Failed to add channel: ${err.message}`);
      alert(`Error: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        log(`User logged in: ${currentUser.email}`);
        
        const profileRef = doc(db, 'users', currentUser.uid);
        unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            const defaultProfile: UserProfile = {
              favoriteChannels: [],
              settings: { autoPlayNext: true }
            };
            setDoc(profileRef, defaultProfile).catch(err => log(`Error creating profile: ${err.message}`));
            setUserProfile(defaultProfile);
          }
        });
      } else {
        log("User logged out");
        setUserProfile(null);
        unsubscribeProfile();
      }
    });

    log("Firebase connected successfully.");
    const unsubscribeDb = onSnapshot(
      collection(db, 'channels'),
      (snapshot) => {
        if (snapshot.empty) {
          log("Warning: 'channels' collection is empty.");
          setChannels([]);
          setLoading(false);
          return;
        }

        const channelData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Channel[];
        
        setChannels(channelData);
        setLoading(false);
        log(`Successfully loaded ${snapshot.size} channels.`);
      },
      (err) => {
        log("Database Error: " + err.message);
        setError(`Failed to load channels: ${err.message}`);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
      unsubscribeDb();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      log(`Login error: ${err.message}`);
      alert(`Login error: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      log(`Logout error: ${err.message}`);
    }
  };

  // Compute filtered channels so we can use it for rendering and auto-play
  const filteredChannels = channels.filter(channel => {
    let matchesCategory = false;
    if (selectedCategory === 'Favorites') {
      matchesCategory = !!(userProfile && userProfile.favoriteChannels.includes(channel.id));
    } else {
      matchesCategory = selectedCategory === 'All' || (channel.category || 'General') === selectedCategory;
    }
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (channel.category || 'General').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const playNextChannel = () => {
    if (userProfile && !userProfile.settings?.autoPlayNext) return;
    if (filteredChannels.length === 0) return;
    
    // Find current index in the filtered list
    let currentIndex = -1;
    if (currentChannel) {
      currentIndex = filteredChannels.findIndex(c => c.id === currentChannel.id);
    }
    
    // Play next (or first if not found / last)
    const nextIndex = (currentIndex + 1) % filteredChannels.length;
    playStream(filteredChannels[nextIndex]);
  };

  const playStream = (channel: Channel) => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentChannel(channel);
    setQualities([]);
    setSelectedQuality(-1);
    log(`Loading: ${channel.name}`);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      
      const hls = new Hls();
      hlsRef.current = hls;
      
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setQualities(data.levels || []);
        video.play().catch(e => log(`Play Error: ${e.message}`));
      });
      
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) log(`HLS Error: ${data.type}`);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = channel.url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => log(`Play Error: ${e.message}`));
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQualityChange = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setSelectedQuality(levelIndex);
      log(`Quality changed to ${levelIndex === -1 ? 'Auto' : `Level ${levelIndex}`}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="p-4 border-b border-gray-800 flex justify-between items-center bg-black sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Tv className="text-red-600 w-6 h-6" />
            <h1 className="text-red-600 font-bold text-xl uppercase tracking-tighter">Osei Movie TV</h1>
          </div>
          <div className="flex gap-2 items-center">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 max-w-[100px] truncate" title={user.email || 'User'}>
                  {user.email}
                </span>
                <button 
                  onClick={() => setShowAddForm(!showAddForm)} 
                  className="text-[10px] bg-red-800 hover:bg-red-700 font-bold px-3 py-1 rounded transition"
                >
                  {showAddForm ? 'CANCEL ADD' : '+ ADD CHANNEL'}
                </button>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded transition flex items-center gap-1"
                >
                  <UserIcon className="w-3 h-3" /> PROFILE
                </button>
                <button
                  onClick={handleLogout}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded transition flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" /> LOGOUT
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="text-[10px] bg-blue-600 hover:bg-blue-500 font-bold px-3 py-1 rounded transition flex items-center gap-1"
              >
                <LogIn className="w-3 h-3" /> LOGIN
              </button>
            )}
            
            <button 
              onClick={() => setShowDebug(!showDebug)} 
              className="text-[10px] bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded transition ml-1"
            >
              DEBUG
            </button>
          </div>
        </header>

        {/* Profile Modal */}
        {showProfileModal && userProfile && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-gray-800">
                <h2 className="font-bold flex items-center gap-2 text-white">
                  <Settings className="w-5 h-5 text-gray-400" /> User Profile & Settings
                </h2>
                <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Display Name</label>
                  <input 
                    type="text" 
                    value={userProfile.displayName || ''}
                    onChange={async (e) => {
                      const newName = e.target.value;
                      setUserProfile({...userProfile, displayName: newName});
                      if (user) {
                        const { doc, updateDoc } = await import('firebase/firestore');
                        updateDoc(doc(db, 'users', user.uid), { displayName: newName })
                          .catch((e) => log(`Error saving name: ${e.message}`));
                      }
                    }}
                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none"
                  />
                </div>
                
                <div className="bg-black border border-gray-800 rounded-lg p-4">
                  <h3 className="font-bold text-sm mb-4 border-b border-gray-800 pb-2">Playback Preferences</h3>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-300">Auto-play next channel</span>
                    <input 
                      type="checkbox"
                      checked={userProfile.settings?.autoPlayNext ?? true}
                      onChange={async (e) => {
                        const newVal = e.target.checked;
                        const updatedProfile = {
                          ...userProfile, 
                          settings: { ...userProfile.settings, autoPlayNext: newVal }
                        };
                        setUserProfile(updatedProfile);
                        if (user) {
                          const { doc, updateDoc } = await import('firebase/firestore');
                          updateDoc(doc(db, 'users', user.uid), { 'settings.autoPlayNext': newVal })
                            .catch((error) => log(`Error saving settings: ${error.message}`));
                        }
                      }}
                      className="w-4 h-4 cursor-pointer accent-red-600"
                    />
                  </label>
                </div>
                
                <div className="text-center pt-2">
                  <p className="text-xs text-gray-500 mb-1">Signed in as {user?.email}</p>
                  <p className="text-[10px] text-gray-600">{userProfile.favoriteChannels.length} favorite channels</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Channel Form */}
        {showAddForm && (
          <div className="p-4 bg-zinc-900 border-b border-gray-800">
            <h3 className="text-red-500 font-bold text-sm mb-3">Add New Channel</h3>
            <form onSubmit={handleAddChannel} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Channel Name *</label>
                <input 
                  type="text" 
                  value={newChannel.name} 
                  onChange={e => setNewChannel({...newChannel, name: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-red-500 outline-none" 
                  placeholder="e.g. Action Movies 24/7"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Stream URL (m3u8) *</label>
                <input 
                  type="url" 
                  value={newChannel.url} 
                  onChange={e => setNewChannel({...newChannel, url: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-red-500 outline-none" 
                  placeholder="https://example.com/stream.m3u8"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category</label>
                  <input 
                    type="text" 
                    value={newChannel.category} 
                    onChange={e => setNewChannel({...newChannel, category: e.target.value})}
                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-red-500 outline-none" 
                    placeholder="e.g. Movies"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Logo URL</label>
                  <input 
                    type="url" 
                    value={newChannel.logo} 
                    onChange={e => setNewChannel({...newChannel, logo: e.target.value})}
                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-red-500 outline-none" 
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea 
                  value={newChannel.description} 
                  onChange={e => setNewChannel({...newChannel, description: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-red-500 outline-none resize-none h-20" 
                  placeholder="Optional channel description..."
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={adding}
                  className="px-4 py-2 text-xs bg-red-600 hover:bg-red-500 font-bold rounded transition disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Save Channel'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Video Player Section */}
        <div className="aspect-video bg-[#111] w-full sticky top-[60px] z-40 shadow-2xl">
          <video 
            ref={videoRef}
            className="w-full h-full" 
            controls 
            autoPlay 
            playsInline
            onEnded={playNextChannel}
          />
        </div>

        {/* Debugging Output */}
        {showDebug && (
          <div className="font-mono text-[10px] text-[#ff5555] bg-[#1a1a1a] p-2.5 mt-2.5 rounded mx-4 max-h-40 overflow-y-auto">
            {debugLogs.map((lg, i) => <div key={i}>{lg}</div>)}
          </div>
        )}

        {/* Channel Info */}
        <div className="p-4 bg-zinc-900 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold">
              {currentChannel ? currentChannel.name : 'Select a Channel'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <p className="text-green-500 text-xs font-bold uppercase tracking-widest">
                Live Now
              </p>
            </div>
            {currentChannel?.description && (
              <p className="text-sm text-gray-400 mt-3 max-w-xl line-clamp-2">{currentChannel.description}</p>
            )}
          </div>
          
          {/* Quality Selector */}
          {qualities.length > 0 && (
            <div className="flex items-center gap-2 bg-black px-3 py-1.5 rounded-lg border border-gray-700">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Quality</span>
              <select 
                value={selectedQuality}
                onChange={(e) => handleQualityChange(Number(e.target.value))}
                className="bg-transparent text-sm font-semibold text-white outline-none cursor-pointer"
              >
                <option value={-1} className="bg-zinc-800">Auto</option>
                {qualities.map((q, i) => (
                  <option key={i} value={i} className="bg-zinc-800">
                    {q.height ? `${q.height}p` : `Level ${i}`} {q.bitrate ? `HD` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Channel List */}
        <div className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-gray-400 uppercase text-xs font-bold flex items-center gap-2">
              <ListVideo className="w-4 h-4" />
              Channel List
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <input 
                type="text" 
                placeholder="Search channels..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-zinc-900 border border-gray-700 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-red-500 w-full sm:w-48"
              />

              {channels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('Favorites')}
                    className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full border transition-colors flex items-center gap-1 ${
                      selectedCategory === 'Favorites' 
                        ? 'bg-yellow-500 border-yellow-500 text-black' 
                        : 'bg-transparent border-gray-700 text-yellow-500 hover:border-yellow-500'
                    }`}
                  >
                    <Star className="w-3 h-3" fill={selectedCategory === 'Favorites' ? "currentColor" : "none"} /> Favorites
                  </button>
                  {['All', ...new Set(channels.map(c => c.category || 'General'))].map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full border transition-colors ${
                        selectedCategory === category 
                          ? 'bg-red-600 border-red-600 text-white' 
                          : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {loading ? (
              <div className="flex justify-center p-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : error ? (
              <p className="text-red-500 text-sm">{error}</p>
            ) : channels.length === 0 ? (
              <p className="text-gray-500 italic text-center py-10">No channels found in database.</p>
             ) : filteredChannels.length === 0 ? (
              <p className="text-gray-500 italic text-center py-10">No channels match your search.</p>
            ) : (
              filteredChannels.map((channel) => (
                <div 
                  key={channel.id}
                  onClick={() => playStream(channel)}
                  className="flex items-center p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-gray-700 cursor-pointer transition-all active:border-red-600 group active:scale-[0.98]"
                >
                  <div className="relative w-12 h-12 mr-4 flex-shrink-0">
                    <img 
                      src={channel.logo || 'https://via.placeholder.com/100'} 
                      alt={channel.name}
                      className="w-full h-full object-cover rounded-lg bg-black border border-gray-600"
                    />
                  </div>
                  <div className="flex-grow">
                    <p className="font-bold text-sm group-hover:text-red-500 transition">{channel.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{channel.category || 'General'}</p>
                  </div>
                  <button 
                    onClick={(e) => toggleFavorite(e, channel)}
                    className="mr-3 p-2 hover:bg-zinc-600 rounded-full transition"
                    title={(userProfile?.favoriteChannels?.includes(channel.id)) ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star 
                      className={`w-5 h-5 ${(userProfile?.favoriteChannels?.includes(channel.id)) ? 'text-yellow-500' : 'text-gray-500 hover:text-yellow-500'}`} 
                      fill={(userProfile?.favoriteChannels?.includes(channel.id)) ? "currentColor" : "none"}
                    />
                  </button>
                  <PlayCircle className="text-gray-500 group-hover:text-red-600 transition w-5 h-5 flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
