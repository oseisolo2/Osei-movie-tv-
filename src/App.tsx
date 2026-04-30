import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, arrayUnion, arrayRemove, addDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import Hls from 'hls.js';
import { Tv, PlayCircle, ListVideo, Star, LogIn, LogOut, User as UserIcon, Settings, X, PlusCircle, SkipBack, SkipForward, Scissors, Square, Camera, Volume2, VolumeX, Keyboard, Cast, Share2, PictureInPicture, Sun, Rewind, FastForward, Pause, Play, Maximize, Scaling } from 'lucide-react';
import AuthModal from './components/AuthModal';
import TermsModal from './components/TermsModal';
import PrivacyModal from './components/PrivacyModal';
import LiveChat from './components/LiveChat';
import ShortcutsModal from './components/ShortcutsModal';
import EPGModal from './components/EPGModal';

interface Channel {
  id: string;
  name: string;
  logo?: string;
  category: string;
  url: string;
  description?: string;
}

interface UserProfile {
  displayName?: string;
  favoriteChannels: string[];
  settings: {
    autoPlayNext: boolean;
    preferredQuality?: number | 'auto';
    bufferLength?: number;
  };
}

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  const showError = (msg: string) => {
    setAppError(msg);
    setTimeout(() => setAppError(null), 5000);
  };
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [addChannelError, setAddChannelError] = useState<string | null>(null);
  const [newChannel, setNewChannel] = useState({ name: '', logo: '', category: '', url: '', description: '' });
  const [adding, setAdding] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showEPGModal, setShowEPGModal] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  
  // Quality options state
  const [qualities, setQualities] = useState<any[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [volume, setVolume] = useState<number>(1);
  const [brightness, setBrightness] = useState<number>(100);
  const [objectFit, setObjectFit] = useState<"contain" | "cover" | "fill">("contain");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCasting, setIsCasting] = useState<boolean>(false);
  const [castAvailable, setCastAvailable] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentChannelRef = useRef<Channel | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const startRecording = () => {
    if (!videoRef.current) return;
    
    // Attempt to get the media stream from the video element
    const videoElement = videoRef.current as any;
    const stream = videoElement.captureStream ? videoElement.captureStream() : videoElement.mozCaptureStream ? videoElement.mozCaptureStream() : null;
    
    if (!stream) {
      showError("Video clipping is not supported in this browser for this video source.");
      return;
    }
    
    recordedChunksRef.current = [];
    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        const now = new Date();
        a.download = `osei-tv-clip-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Date.now()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
        log("Clip downloaded successfully");
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      log("Started recording clip");
    } catch (e: any) {
      console.error("MediaRecorder error:", e);
      showError(`Could not start clipping: ${e.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      log("Stopped recording clip");
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
      
      if (canvas.width === 0 || canvas.height === 0) {
        showError("Video hasn't loaded enough to take a snapshot yet.");
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = dataUrl;
        const now = new Date();
        a.download = `osei-tv-snapshot-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Date.now()}.png`;
        a.click();
        document.body.removeChild(a);
        
        log("Quality picture captured");
      }
    } catch (e: any) {
      console.error("Snapshot error:", e);
      showError("Could not capture picture. The stream source may have cross-origin restrictions.");
    }
  };

  const log = (msg: string) => {
    setDebugLogs(prev => [...prev, `> ${msg}`]);
    console.log(msg);
  };

  const toggleFavorite = async (e: import('react').MouseEvent, channel: Channel) => {
    e.stopPropagation();
    if (!user || !userProfile) {
      showError("Please sign in to favorite channels.");
      setShowAuthModal(true);
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
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleAddChannel = async (e: import('react').FormEvent) => {
    e.preventDefault();
    setAddChannelError(null);
    if (!user) {
      setAddChannelError("Please log in to add a new channel.");
      setShowAuthModal(true);
      return;
    }
    if (!newChannel.name || !newChannel.url) {
      setAddChannelError('Channel name and stream URL are required fields.');
      return;
    }

    let urlValid = false;
    try {
      const parsedUrl = new URL(newChannel.url);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        urlValid = true;
      }
    } catch {
      // Invalid URL
    }

    if (!urlValid) {
      setAddChannelError('Please enter a valid stream URL starting with http:// or https://');
      return;
    }

    setAdding(true);
    try {
      const { addDoc } = await import('firebase/firestore');
      
      const channelToSave: any = { 
        name: newChannel.name, 
        url: newChannel.url 
      };
      if (newChannel.logo.trim()) channelToSave.logo = newChannel.logo.trim();
      if (newChannel.category.trim()) channelToSave.category = newChannel.category.trim();
      if (newChannel.description.trim()) channelToSave.description = newChannel.description.trim();

      await addDoc(collection(db, 'channels'), channelToSave);
      setNewChannel({ name: '', logo: '', category: '', url: '', description: '' });
      setShowAddForm(false);
      log(`Successfully added channel: ${newChannel.name}`);
    } catch (err: any) {
      setAddChannelError('Failed to add channel. Please make sure the stream URL is correct and you have permission.');
      handleFirestoreError(err, OperationType.CREATE, 'channels');
    } finally {
      setAdding(false);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: () => void = () => {};

    const testConnection = async () => {
      try {
        const { getDocFromServer, doc } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        log(`User logged in: ${currentUser.email}`);
        
        const profileRef = doc(db, 'users', currentUser.uid);
        unsubscribeProfile = onSnapshot(
          profileRef, 
          (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as UserProfile);
            } else {
              const defaultProfile: UserProfile = {
                favoriteChannels: [],
                settings: { autoPlayNext: true, preferredQuality: 'auto', bufferLength: 30 }
              };
              setDoc(profileRef, defaultProfile).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${currentUser.uid}`));
              setUserProfile(defaultProfile);
            }
          },
          (error) => {
             handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          }
        );
      } else {
        log("User logged out");
        setUserProfile(null);
        unsubscribeProfile();
      }
    });

    log("Firebase connected successfully.");

    const defaultChannels: Channel[] = [
      {
        id: 'local_news_1',
        name: 'Sky News',
        url: 'https://skynews-eu.cbsivideo.com/clippr/free/master.m3u8',
        category: 'News',
        description: 'Sky News UK Live stream',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/fa/Sky_News_2020.svg/512px-Sky_News_2020.svg.png'
      },
      {
        id: 'local_news_2',
        name: 'CBS News',
        url: 'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8',
        category: 'News',
        description: 'CBS News Live Stream',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/CBS_News_logo.svg/512px-CBS_News_logo.svg.png'
      },
      {
        id: 'local_news_3',
        name: 'Al Jazeera English',
        url: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
        category: 'News',
        description: 'Al Jazeera English Live Stream',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Aljazeera_eng.svg/512px-Aljazeera_eng.svg.png'
      },
      {
        id: 'local_news_4',
        name: 'France 24 English',
        url: 'https://static.france24.com/live/F24_EN_HI_HLS/video_def.m3u8',
        category: 'News',
        description: 'France 24 English Live',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/France_24_logo_%282024%29.svg/512px-France_24_logo_%282024%29.svg.png'
      },
      {
        id: 'news_bloomberg',
        name: 'Bloomberg TV+',
        url: 'https://live.bloomberg.tv/bloomberg/playlist.m3u8',
        category: 'News',
        description: 'Bloomberg Global Financial News',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloomberg_Television_logo.svg/512px-Bloomberg_Television_logo.svg.png'
      },
      {
        id: 'news_abc',
        name: 'ABC News Live',
        url: 'https://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8',
        category: 'News',
        description: 'ABC News Live Stream',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/ABC_News_logo_2021.svg/512px-ABC_News_logo_2021.svg.png'
      },
      {
        id: 'news_dw',
        name: 'DW English',
        url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
        category: 'News',
        description: 'Deutsche Welle English Live',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/DW_logo_%282012%29.svg/512px-DW_logo_%282012%29.svg.png'
      },
      {
        id: 'news_cna',
        name: 'CNA',
        url: 'https://d2e1asnsl7br7b.cloudfront.net/7782e205e72f43aeb4a480973e06f12a/index.m3u8',
        category: 'News',
        description: 'Channel NewsAsia Live',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/CNA_logo_%282019%29.svg/512px-CNA_logo_%282019%29.svg.png'
      },
      {
        id: 'local_ent_1',
        name: 'Red Bull TV',
        url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
        category: 'Entertainment',
        description: 'Red Bull TV Live',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Red_Bull_TV_logo.svg/512px-Red_Bull_TV_logo.svg.png'
      },
      {
        id: 'ent_ign',
        name: 'IGN TV',
        url: 'https://ign-us.amagi.tv/playlist.m3u8',
        category: 'Entertainment',
        description: 'IGN TV - Gaming & Pop Culture',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/IGN_logo_%28current%29.svg/512px-IGN_logo_%28current%29.svg.png'
      },
      {
        id: 'ent_tastemade',
        name: 'Tastemade',
        url: 'https://tastemade-tastemade-2-eu.rakuten.wurl.tv/playlist.m3u8',
        category: 'Lifestyle',
        description: 'Tastemade Food & Travel',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Tastemade_logo.svg/512px-Tastemade_logo.svg.png'
      },
      {
        id: 'local_edu_1',
        name: 'NASA TV',
        url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
        category: 'Science',
        description: 'NASA TV HD Live',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/512px-NASA_logo.svg.png'
      },
      {
        id: 'nature_vision',
        name: 'NatureVision TV',
        url: 'https://naturevision-us.amagi.tv/playlist.m3u8',
        category: 'Nature',
        description: 'NatureVision TV 24/7',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Nature_Vision_TV_logo.png/512px-Nature_Vision_TV_logo.png'
      },
      {
        id: 'local_sports_1',
        name: 'PGA Tour',
        url: 'https://pgatour.amagi.tv/playlist.m3u8',
        category: 'Sports',
        description: 'PGA Tour Live',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9c/PGA_Tour_logo.svg/512px-PGA_Tour_logo.svg.png'
      },
      {
        id: 'music_vevo',
        name: 'Vevo Pop',
        url: 'https://vevo-pop-us.amagi.tv/playlist.m3u8',
        category: 'Music',
        description: 'Vevo Pop Music Videos',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Vevo_logo.svg/512px-Vevo_logo.svg.png'
      },
      {
        id: 'local_ent_2',
        name: 'Rakuten Viki',
        url: 'https://rakuten-viki-1-eu.rakuten.wurl.tv/playlist.m3u8',
        category: 'Entertainment',
        description: 'Rakuten Viki Live',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Rakuten_logo.svg/512px-Rakuten_logo.svg.png'
      }
    ];

    const unsubscribeDb = onSnapshot(
      collection(db, 'channels'),
      (snapshot) => {
        const firebaseChannels = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Channel[];
        
        // Merge firebaseChannels with defaultChannels
        const combinedChannels = [...firebaseChannels];
        defaultChannels.forEach(dc => {
          if (!firebaseChannels.find(fc => fc.id === dc.id)) {
            combinedChannels.push(dc);
          }
        });
        
        setChannels(combinedChannels);
        setLoading(false);
        log(`Loaded ${snapshot.size} channels from DB, ${combinedChannels.length - firebaseChannels.length} defaults.`);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'channels');
      }
    );

    // Initialize Cast Context when script loads
    // @ts-ignore
    window.__onGCastApiAvailable = function (isAvailable: boolean) {
      // @ts-ignore
      if (isAvailable && window.cast && window.chrome) {
        setCastAvailable(true);
        // @ts-ignore
        window.cast.framework.CastContext.getInstance().setOptions({
          // @ts-ignore
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          // @ts-ignore
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });
        
        const handleCastStateChange = (event: any) => {
          // @ts-ignore
          const connected = event.castState === window.cast.framework.CastState.CONNECTED;
          setIsCasting(connected);
          
          if (connected && currentChannelRef.current) {
             // @ts-ignore
             const castSession = window.cast.framework.CastContext.getInstance().getCurrentSession();
             if (castSession) {
               const ch = currentChannelRef.current;
               // @ts-ignore
               const mediaInfo = new window.chrome.cast.media.MediaInfo(ch.url, 'application/x-mpegURL');
               // @ts-ignore
               mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
               mediaInfo.metadata.title = ch.name;
               if (ch.logo) {
                 mediaInfo.metadata.images = [{ url: ch.logo }];
               }
               // @ts-ignore
               const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
               castSession.loadMedia(request);
               if (videoRef.current) videoRef.current.pause();
             }
          } else {
             if (videoRef.current && videoRef.current.paused && currentChannelRef.current) {
                videoRef.current.play().catch(e => console.error(e));
             }
          }
        };

        // @ts-ignore
        window.cast.framework.CastContext.getInstance().addEventListener(
          // @ts-ignore
          window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          handleCastStateChange
        );
      }
    };

    const authUnsub = unsubscribeAuth;
    const profUnsub = unsubscribeProfile;
    const dbUnsub = unsubscribeDb;

    return () => {
      authUnsub();
      profUnsub();
      dbUnsub();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      const video = videoRef.current;
      if (!video && !currentChannel) return;

      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video) {
            video.paused ? video.play().catch(console.error) : video.pause();
          }
          break;
        case 'm':
          e.preventDefault();
          if (video) {
            video.muted = !video.muted;
          }
          break;
        case 'f':
          e.preventDefault();
          if (video) {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(console.error);
            } else {
              video.requestFullscreen().catch(console.error);
            }
          }
          break;
        case 'i':
          e.preventDefault();
          if (video) {
            togglePiP();
          }
          break;
        case 'arrowup':
          e.preventDefault();
          if (video) {
            video.volume = Math.min(1, video.volume + 0.1);
          }
          break;
        case 'arrowdown':
          e.preventDefault();
          if (video) {
            video.volume = Math.max(0, video.volume - 0.1);
          }
          break;
        case 'arrowleft':
        case 'p':
          e.preventDefault();
          playPrevChannel();
          break;
        case 'arrowright':
        case 'n':
          e.preventDefault();
          playNextChannel(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentChannel, filteredChannels, userProfile]);

  const handleLogin = () => {
    setShowAuthModal(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      log(`Logout error: ${err.message}`);
    }
  };

  const playNextChannel = (isAutoPlay = false) => {
    if (isAutoPlay && userProfile && !userProfile.settings?.autoPlayNext) return;
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

  const playPrevChannel = () => {
    if (filteredChannels.length === 0) return;
    
    let currentIndex = -1;
    if (currentChannel) {
      currentIndex = filteredChannels.findIndex(c => c.id === currentChannel.id);
    }
    
    // Play previous (or last if not found / first)
    const prevIndex = currentIndex <= 0 ? filteredChannels.length - 1 : currentIndex - 1;
    playStream(filteredChannels[prevIndex]);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000); // Hide after 5 seconds
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      // Check feature policy and browser support
      if (typeof document.pictureInPictureEnabled === 'undefined' || !document.pictureInPictureEnabled) {
        showToast('PiP is unavailable in this view. Try opening the app in a new tab.');
        return;
      }
      
      if (videoRef.current.readyState === 0) {
        showToast('Please wait for the video to load before starting Picture-in-Picture.');
        return;
      }
      
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('Failed to enter/exit PiP:', error);
      showToast('Picture-in-Picture failed. Try opening the app in a new tab.');
    }
  };

  const toggleFullscreen = async () => {
    if (!videoRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await videoRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error('Failed to enter/exit fullscreen:', error);
      showToast('Fullscreen failed. Try opening the app in a new tab.');
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
    if (newVolume === 0) {
      setIsMuted(true);
    }
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBrightness(parseInt(e.target.value));
  };

  const toggleObjectFit = () => {
    setObjectFit(current => {
      if (current === "contain") return "cover";
      if (current === "cover") return "fill";
      return "contain";
    });
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const seekForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += 10;
    }
  };

  const seekBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime -= 10;
    }
  };

  const handlePlaybackRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
      if (!newMuted && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  const isYouTube = currentChannel?.url.includes('youtube.com') || currentChannel?.url.includes('youtu.be');

  const getYouTubeIframeUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      if (url.includes('youtube.com/channel/')) {
        const channelId = url.split('youtube.com/channel/')[1].split('/')[0].split('?')[0];
        return `https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1`;
      } else if (urlObj.searchParams.get('v')) {
        return `https://www.youtube.com/embed/${urlObj.searchParams.get('v')}?autoplay=1`;
      } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1].split('?')[0];
        return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      } else if (url.includes('youtube.com/embed/')) {
        return url + (url.includes('?') ? '&autoplay=1' : '?autoplay=1');
      }
    } catch (e) {
      // Ignore URL parse errors
    }
    return url; // fallback
  };

  const playStream = (channel: Channel) => {
    stopRecording();
    setCurrentChannel(channel);
    currentChannelRef.current = channel;
    setQualities([]);
    setSelectedQuality(-1);
    setIsBuffering(true);
    setStreamError(null);
    setToastMessage(null);
    
    // Apply current volume & playback rate
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
      videoRef.current.playbackRate = playbackRate;
    }
    log(`Loading: ${channel.name}`);
    
    // Check if we are casting
    // @ts-ignore
    if (window.cast?.framework) {
      // @ts-ignore
      const castSession = window.cast.framework.CastContext.getInstance().getCurrentSession();
      if (castSession) {
        // @ts-ignore
        const mediaInfo = new window.chrome.cast.media.MediaInfo(channel.url, 'application/x-mpegURL');
        // @ts-ignore
        mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = channel.name;
        if (channel.logo) {
          mediaInfo.metadata.images = [{ url: channel.logo }];
        }
        // @ts-ignore
        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
        request.autoplay = true;
        castSession.loadMedia(request);
      }
    }
    
    // Check if it's YouTube, if it is, we don't need to load Hls, just let the iframe render
    if (channel.url.includes('youtube.com') || channel.url.includes('youtu.be')) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      
      const bufferLen = userProfile?.settings?.bufferLength || 30;

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: bufferLen,
        maxMaxBufferLength: Math.max(600, bufferLen * 2)
      });
      hlsRef.current = hls;
      
      let retryCount = 0;
      const MAX_RETRIES = 5;
      
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setQualities(data.levels || []);
        
        const preferred = userProfile?.settings?.preferredQuality;
        if (preferred !== undefined && preferred !== 'auto') {
          const levelIndex = data.levels.findIndex((l: any) => l.height === preferred);
          if (levelIndex !== -1) {
            hls.currentLevel = levelIndex;
            setSelectedQuality(levelIndex);
          }
        }
        
        video.play().catch(e => log(`Play Error: ${e.message}`));
      });
      
      let toastTimeout: NodeJS.Timeout;

      hls.on(Hls.Events.ERROR, (_event, data) => {
        log(`HLS Error: ${data.type} (fatal: ${data.fatal})`);

        if (!data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setToastMessage("Experiencing network instability...");
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
              setToastMessage(null);
            }, 3000);
          }
          return;
        }

        if (data.fatal) {
          if (retryCount >= MAX_RETRIES) {
            hls.destroy();
            setStreamError("This channel is currently unavailable after multiple attempts.");
            setIsBuffering(false);
            return;
          }
          retryCount++;
          
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponental backoff: 2s, 4s, 8s, 10s...
          
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              log(`fatal network error encountered, try to recover in ${backoffDelay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
              setStreamError(`Network error. Retrying in ${backoffDelay/1000}s... (${retryCount}/${MAX_RETRIES})`);
              setTimeout(() => {
                if (hlsRef.current === hls) {
                  hls.startLoad();
                }
              }, backoffDelay);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              log(`fatal media error encountered, try to recover in ${backoffDelay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
              setStreamError(`Media error. Retrying in ${backoffDelay/1000}s... (${retryCount}/${MAX_RETRIES})`);
              setTimeout(() => {
                if (hlsRef.current === hls) {
                  hls.recoverMediaError();
                }
              }, backoffDelay);
              break;
            default:
              // cannot recover
              hls.destroy();
              setStreamError("This channel is currently unavailable or doesn't work.");
              setIsBuffering(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = channel.url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => log(`Play Error: ${e.message}`));
      });
      video.onerror = () => {
        setStreamError("This channel is currently unavailable or doesn't work (fallback player error).");
        setIsBuffering(false);
      };
    }
  };

  const handleQualityChange = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setSelectedQuality(levelIndex);
      log(`Quality changed to ${levelIndex === -1 ? 'Auto' : `Level ${levelIndex}`}`);
    }
  };

  const handleShare = async () => {
    try {
      const shareTitle = currentChannel ? `Watch ${currentChannel.name} on Osei TV` : 'Osei TV';
      const shareText = currentChannel ? `Check out the ${currentChannel.name} live stream on Osei TV!` : 'Check out Osei TV for the best live channels!';
      
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.log('Error sharing:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="p-4 border-b border-gray-800 flex justify-between items-center bg-black sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Tv className="text-red-600 w-6 h-6" />
            <h1 className="text-red-600 font-bold text-xl uppercase tracking-tighter">Osei tv</h1>
          </div>
          <div className="flex gap-2 items-center overflow-x-auto no-scrollbar pb-1 -mb-1">
            {castAvailable && (
              <button
                onClick={() => {
                  // @ts-ignore
                  if (window.cast?.framework) {
                    // @ts-ignore
                    const castSession = window.cast.framework.CastContext.getInstance().getCurrentSession();
                    if (castSession) {
                      // @ts-ignore
                      castSession.endSession(true);
                    } else {
                      // @ts-ignore
                      window.cast.framework.CastContext.getInstance().requestSession();
                    }
                  }
                }}
                className={`shrink-0 text-[10px] px-3 py-1 rounded transition flex items-center gap-1 border ${isCasting ? 'bg-red-600 border-red-500 hover:bg-red-700 hover:border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-zinc-800 border-gray-700 hover:bg-zinc-700 hover:border-gray-500'}`}
                title={isCasting ? "Stop Casting" : "Cast to TV"}
              >
                <Cast className={`w-3 h-3 ${isCasting ? 'animate-pulse' : ''}`} /> {isCasting ? "STOP CASTING" : "CAST"}
              </button>
            )}
            <button
              onClick={() => setShowEPGModal(true)}
              className="shrink-0 text-[10px] bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded transition flex items-center gap-1 border border-gray-700 hover:border-gray-500 text-yellow-500 hover:text-yellow-400 font-bold"
              title="TV Guide"
            >
              <ListVideo className="w-3 h-3" /> TV GUIDE
            </button>
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="shrink-0 text-[10px] bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded transition flex items-center gap-1 border border-gray-700 hover:border-gray-500"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-3 h-3" /> SHORTCUTS
            </button>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 max-w-[100px] truncate" title={user.email || 'User'}>
                  {user.email}
                </span>
                <button 
                  onClick={() => setShowAddForm(!showAddForm)} 
                  className="shrink-0 text-[10px] bg-red-800 hover:bg-red-700 font-bold px-3 py-1 rounded transition whitespace-nowrap"
                >
                  {showAddForm ? 'CANCEL ADD' : '+ ADD CHANNEL'}
                </button>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="shrink-0 text-[10px] bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded transition flex items-center gap-1 whitespace-nowrap"
                >
                  <Settings className="w-3 h-3" /> <span className="hidden sm:inline">SETTINGS</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="shrink-0 text-[10px] bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded transition flex items-center gap-1 whitespace-nowrap"
                >
                  <LogOut className="w-3 h-3" /> <span className="hidden sm:inline">LOGOUT</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="shrink-0 text-[10px] bg-blue-600 hover:bg-blue-500 font-bold px-3 py-1 rounded transition flex items-center gap-1 whitespace-nowrap"
              >
                <LogIn className="w-3 h-3" /> LOG IN
              </button>
            )}
            
            <button 
              onClick={() => setShowDebug(!showDebug)} 
              className="shrink-0 text-[10px] bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded transition ml-1"
            >
              DEBUG
            </button>
          </div>
        </header>

        {appError && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-red-600/90 border border-red-500 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-4">
            <span className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center text-[10px]">!</span>
            {appError}
          </div>
        )}

        {showShortcutsModal && (
          <ShortcutsModal onClose={() => setShowShortcutsModal(false)} />
        )}

        {showEPGModal && (
          <EPGModal 
            channels={channels}
            currentChannelId={currentChannel?.id}
            onClose={() => setShowEPGModal(false)}
            onSelectChannel={(channel) => playStream(channel)}
          />
        )}

        {showAuthModal && (
          <AuthModal 
            onClose={() => setShowAuthModal(false)} 
            onSuccess={() => setShowAuthModal(false)} 
          />
        )}

        {showTerms && (
          <TermsModal onClose={() => setShowTerms(false)} />
        )}

        {showPrivacy && (
          <PrivacyModal onClose={() => setShowPrivacy(false)} />
        )}

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
                          .catch((e) => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`));
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
                            .catch((error) => handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`));
                        }
                      }}
                      className="w-4 h-4 cursor-pointer accent-red-600"
                    />
                  </label>

                  <label className="flex items-center justify-between mt-4">
                    <span className="text-sm text-gray-300">Preferred Quality</span>
                    <select
                      value={userProfile.settings?.preferredQuality || 'auto'}
                      onChange={async (e) => {
                        let newVal: number | 'auto' = e.target.value === 'auto' ? 'auto' : parseInt(e.target.value);
                        const updatedProfile = {
                          ...userProfile, 
                          settings: { ...userProfile.settings, preferredQuality: newVal }
                        };
                        setUserProfile(updatedProfile);
                        if (user) {
                          const { doc, updateDoc } = await import('firebase/firestore');
                          updateDoc(doc(db, 'users', user.uid), { 'settings.preferredQuality': newVal })
                            .catch((error) => handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`));
                        }
                      }}
                      className="bg-black border border-gray-700 rounded p-1 px-2 text-xs outline-none text-white focus:border-red-500"
                    >
                      <option value="auto">Auto</option>
                      <option value="1080">1080p</option>
                      <option value="720">720p</option>
                      <option value="480">480p</option>
                      <option value="360">360p</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between mt-4">
                    <span className="text-sm text-gray-300">Buffer Length</span>
                    <select
                      value={userProfile.settings?.bufferLength || 30}
                      onChange={async (e) => {
                        let newVal = parseInt(e.target.value);
                        const updatedProfile = {
                          ...userProfile, 
                          settings: { ...userProfile.settings, bufferLength: newVal }
                        };
                        setUserProfile(updatedProfile);
                        if (user) {
                          const { doc, updateDoc } = await import('firebase/firestore');
                          updateDoc(doc(db, 'users', user.uid), { 'settings.bufferLength': newVal })
                            .catch((error) => handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`));
                        }
                      }}
                      className="bg-black border border-gray-700 rounded p-1 px-2 text-xs outline-none text-white focus:border-red-500"
                    >
                      <option value="10">10s (Low latency)</option>
                      <option value="30">30s (Default)</option>
                      <option value="60">60s (Stable)</option>
                      <option value="120">120s (Slow connection)</option>
                    </select>
                  </label>
                </div>
                
                <div className="bg-black border border-gray-800 rounded-lg p-4">
                  <h3 className="font-bold text-sm mb-4 border-b border-gray-800 pb-2">Favorite Channels</h3>
                  {userProfile.favoriteChannels.length === 0 ? (
                    <p className="text-xs text-gray-500">No favorite channels added yet.</p>
                  ) : (
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {userProfile.favoriteChannels.map(favId => {
                        const channel = channels.find(c => c.id === favId);
                        return (
                          <li key={favId} className="flex justify-between items-center text-sm">
                            <span className="text-gray-300 truncate mr-2">{channel ? channel.name : 'Unknown Channel'}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(e, channel || { id: favId } as Channel);
                              }}
                              className="text-red-500 hover:text-red-400 text-xs shrink-0"
                            >
                              Remove
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="text-center pt-2 mt-4">
                  <p className="text-xs text-gray-500 mb-1">Signed in as {user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Channel Form */}
        {showAddForm && (
          <div className="p-4 bg-zinc-900 border-b border-gray-800">
            <h3 className="text-red-500 font-bold text-sm mb-3">Add New Channel</h3>
            
            {addChannelError && (
              <div className="mb-4 bg-red-500/20 border border-red-500 text-red-500 text-xs p-3 rounded">
                {addChannelError}
              </div>
            )}
            
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
        <div className="aspect-video bg-[#111] w-full sticky top-[60px] z-40 shadow-2xl relative">
          {isYouTube ? (
            <div className="w-full h-full relative">
              <iframe
                src={getYouTubeIframeUrl(currentChannel?.url || '')}
                className="w-full h-full absolute inset-0 z-10"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
              <div className="absolute inset-x-0 bottom-0 z-20 bg-black/80 text-white text-xs p-2 flex justify-between items-center opacity-0 hover:opacity-100 transition-opacity">
                <span>If the video is unavailable due to restrictions, watch it directly on YouTube:</span>
                <a 
                  href={currentChannel?.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded font-bold transition"
                >
                  Watch on YouTube
                </a>
              </div>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef}
                className="w-full h-full absolute inset-0 cursor-pointer" 
                controls 
                autoPlay 
                playsInline
                style={{ filter: `brightness(${brightness}%)`, objectFit }}
                crossOrigin="anonymous"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                onEnded={() => playNextChannel(true)}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => {
                  setIsBuffering(false);
                  setIsPlaying(true);
                }}
                onPause={() => setIsPlaying(false)}
                onCanPlay={() => setIsBuffering(false)}
                onError={() => {
                  setStreamError("This channel is currently unavailable or doesn't work.");
                  setIsBuffering(false);
                }}
              />
              {streamError && !isCasting && (
                <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center p-4">
                  <span className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mb-4">
                    <span className="text-red-500 font-bold text-xl">!</span>
                  </span>
                  <p className="text-white text-center font-medium">{streamError}</p>
                </div>
              )}
              {toastMessage && !isCasting && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-zinc-800/95 border border-zinc-700 text-white text-xs font-bold px-3 py-2 rounded shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
                  {toastMessage}
                </div>
              )}
              {isBuffering && !isCasting && !streamError && (
                <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center pointer-events-none">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
                </div>
              )}
              {isCasting && (
                <div className="absolute inset-0 z-20 bg-black/90 flex flex-col items-center justify-center pointer-events-none">
                  <Cast className="w-16 h-16 text-red-600 mb-4 animate-pulse" />
                  <p className="text-xl font-bold text-white tracking-widest uppercase">Casting to TV</p>
                  <p className="text-gray-400 mt-2 text-sm">{currentChannel?.name}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Debugging Output */}
        {showDebug && (
          <div className="font-mono text-[10px] text-[#ff5555] bg-[#1a1a1a] p-2.5 mt-2.5 rounded mx-4 max-h-40 overflow-y-auto">
            {debugLogs.map((lg, i) => <div key={i}>{lg}</div>)}
          </div>
        )}

        {isYouTube && currentChannel && (
          <div className="bg-zinc-800 border-b border-gray-700 px-4 py-3 flex justify-between items-center text-sm">
            <span className="text-gray-300 text-xs sm:text-sm">Video unavailable? The broadcaster may have disabled embedding.</span>
            <a 
              href={currentChannel.url} 
              target="_blank" 
              rel="noreferrer"
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-full font-semibold transition whitespace-nowrap text-xs sm:text-sm ml-2"
            >
              Watch on YouTube
            </a>
          </div>
        )}

        {/* Channel Info */}
        <div className="p-4 bg-zinc-900 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex-grow">
            <h2 className="text-xl font-bold flex items-center gap-2">
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
          
          <div className="flex items-center gap-3 self-start sm:self-auto shrink-0 mt-3 sm:mt-0 flex-wrap">
            {/* Take Snapshot Button */}
            {!isYouTube && currentChannel && (
              <button 
                onClick={takeSnapshot}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-black border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs font-bold uppercase transition"
                title="Take High Quality Picture"
              >
                <Camera className="w-4 h-4" /> Snapshot
              </button>
            )}

            {/* Record Clip Button */}
            {!isYouTube && currentChannel && (
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition ${
                  isRecording 
                    ? 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30' 
                    : 'bg-black border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 fill-current" /> Stop REC
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" /> Clip 
                  </>
                )}
              </button>
            )}

            {/* Picture-in-Picture Button */}
            {!isYouTube && currentChannel && (
              <>
                <button 
                  onClick={togglePiP}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-black border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs font-bold uppercase transition"
                  title="Picture in Picture"
                >
                  <PictureInPicture className="w-4 h-4" /> PiP
                </button>
                <button 
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-black border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs font-bold uppercase transition"
                  title="Fullscreen"
                >
                  <Maximize className="w-4 h-4" /> Fullscreen
                </button>
                <button 
                  onClick={toggleObjectFit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-black border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs font-bold uppercase transition"
                  title={`Resize (current: ${objectFit})`}
                >
                  <Scaling className="w-4 h-4" /> {objectFit}
                </button>
              </>
            )}

            {/* Share Button */}
            <button 
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-black border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs font-bold uppercase transition"
              title="Share Stream"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>

            <div className="flex bg-black rounded-lg border border-gray-700 p-0.5">
              <button 
                onClick={playPrevChannel}
                className="p-2 hover:bg-zinc-800 rounded-md transition text-gray-300 hover:text-white flex items-center gap-1 text-xs font-medium"
                title="Previous Channel"
              >
                <SkipBack className="w-4 h-4" /> Prev
              </button>
              <div className="w-px bg-gray-700 my-1"></div>
              <button 
                onClick={() => playNextChannel(false)}
                className="p-2 hover:bg-zinc-800 rounded-md transition text-gray-300 hover:text-white flex items-center gap-1 text-xs font-medium"
                title="Next Channel"
              >
                Next <SkipForward className="w-4 h-4" />
              </button>
            </div>
          
          {/* Media Transport Controls */}
          {!isYouTube && currentChannel && (
            <div className="flex bg-black rounded-lg border border-gray-700 p-0.5 shrink-0">
              <button 
                onClick={seekBackward}
                className="p-1.5 hover:bg-zinc-800 rounded-md transition text-gray-300 hover:text-white"
                title="Rewind 10s"
              >
                <Rewind className="w-5 h-5" />
              </button>
              <div className="w-px bg-gray-700 my-1"></div>
              <button 
                onClick={togglePlayPause}
                className="p-1.5 hover:bg-zinc-800 rounded-md transition text-gray-300 hover:text-white"
                title="Play/Pause"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <div className="w-px bg-gray-700 my-1"></div>
              <button 
                onClick={seekForward}
                className="p-1.5 hover:bg-zinc-800 rounded-md transition text-gray-300 hover:text-white"
                title="Forward 10s"
              >
                <FastForward className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Volume Control */}
          <div className="flex items-center gap-2 bg-black px-3 py-1.5 rounded-lg border border-gray-700 w-28 sm:w-32 shrink-0">
            <button onClick={toggleMute} className="text-gray-400 hover:text-white transition">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={isMuted ? 0 : volume} 
              onChange={handleVolumeChange}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>
          
          {/* Brightness Control */}
          {!isYouTube && currentChannel && (
            <div className="flex items-center gap-2 bg-black px-3 py-1.5 rounded-lg border border-gray-700 w-28 sm:w-32 shrink-0" title={`Brightness: ${brightness}%`}>
              <Sun className="w-4 h-4 text-gray-400" />
              <input 
                type="range" 
                min="20" 
                max="200" 
                step="1" 
                value={brightness} 
                onChange={handleBrightnessChange}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
              <span className="text-[10px] font-bold text-gray-400 w-6 text-right leading-none">{brightness}%</span>
            </div>
          )}

          {/* Playback Speed Selector */}
          {!isYouTube && currentChannel && (
            <div className="flex items-center gap-2 bg-black px-3 py-1.5 rounded-lg border border-gray-700 shrink-0">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Speed</span>
              <select 
                value={playbackRate}
                onChange={handlePlaybackRateChange}
                className="bg-transparent text-sm font-semibold text-white outline-none cursor-pointer"
              >
                <option value={0.5} className="bg-zinc-800">0.5x</option>
                <option value={1} className="bg-zinc-800">1x</option>
                <option value={1.25} className="bg-zinc-800">1.25x</option>
                <option value={1.5} className="bg-zinc-800">1.5x</option>
                <option value={2} className="bg-zinc-800">2x</option>
              </select>
            </div>
          )}

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
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
          
          {/* Channel List */}
          <div className="lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-gray-400 uppercase text-xs font-bold flex items-center gap-2">
                <ListVideo className="w-4 h-4" />
                Channel List
              </h3>
              
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
                  <input 
                    type="text" 
                    placeholder="Search channels..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-zinc-900 border border-gray-700 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-red-500 w-full sm:w-48"
                  />

                  {channels.length > 0 && (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <select
                        value={selectedCategory === 'Favorites' ? 'All' : selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-zinc-900 border border-gray-700 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-red-500 flex-grow sm:flex-grow-0"
                      >
                        <option value="All">All Categories</option>
                        {Array.from(new Set(channels.filter(c => c.category).map(c => c.category))).map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => setSelectedCategory(selectedCategory === 'Favorites' ? 'All' : 'Favorites')}
                        className={`px-3 py-1.5 text-xs font-bold tracking-wider rounded-md border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                          selectedCategory === 'Favorites' 
                            ? 'bg-yellow-500 border-yellow-500 text-black' 
                            : 'bg-zinc-900 border-gray-700 text-yellow-500 hover:border-yellow-500'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5" fill={selectedCategory === 'Favorites' ? "currentColor" : "none"} /> 
                        <span className="hidden sm:inline">Favorites</span>
                      </button>
                    </div>
                  )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
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
          
          {/* Live Chat */}
          <div className="lg:col-span-1">
            {currentChannel ? (
              <LiveChat channelId={currentChannel.id} user={user} onShowAuth={() => setShowAuthModal(true)} />
            ) : (
              <div className="flex justify-center items-center h-[400px] bg-zinc-900 border border-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 font-medium">Select a channel to join the chat</p>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-gray-800 p-8 flex flex-col items-center gap-6 text-sm text-gray-500 font-medium">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs md:text-sm">
            <a href="#" className="hover:text-red-400 transition" target="_blank" rel="noopener noreferrer">Join our Group</a>
            <a href="#" className="hover:text-red-400 transition" target="_blank" rel="noopener noreferrer">Forum</a>
            <a href="#" className="hover:text-red-400 transition" target="_blank" rel="noopener noreferrer">Official Website</a>
            <a href="#" className="hover:text-red-400 transition" target="_blank" rel="noopener noreferrer">YouTube Channels</a>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs md:text-sm">
            <button className="hover:text-red-400 transition" onClick={handleShare}>Share</button>
            <a href="#" className="hover:text-red-400 transition">Check for Updates</a>
            <button className="hover:text-red-400 transition" onClick={() => setShowTerms(true)}>Terms of Service</button>
            <button className="hover:text-red-400 transition" onClick={() => setShowPrivacy(true)}>Privacy Policy</button>
            <span className="hidden sm:inline text-gray-700">|</span>
            <span className="text-gray-400 italic">Thank You!</span>
          </div>
          
          <p className="mt-2 opacity-60 text-xs">© {new Date().getFullYear()} Osei TV. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
