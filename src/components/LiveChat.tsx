import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, limit, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Send, LogIn } from 'lucide-react';

interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  displayName: string;
  timestamp: any;
}

interface LiveChatProps {
  channelId: string;
  user: User | null;
  onShowAuth: () => void;
}

export default function LiveChat({ channelId, user, onShowAuth }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<{userId: string, displayName: string}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!channelId) return;
    
    setLoading(true);
    const q = query(
      collection(db, `channels/${channelId}/messages`),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => scrollToBottom(), 100);
    }, (error) => {
      console.error("Chat error:", error);
      handleFirestoreError(error, OperationType.GET, `channels/${channelId}/messages`);
      setLoading(false);
    });

    const unsubscribeTyping = onSnapshot(collection(db, `channels/${channelId}/typing`), (snapshot) => {
      const typers: {userId: string, displayName: string}[] = [];
      const now = Date.now();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isTyping && docSnap.id !== user?.uid) {
           if (data.lastTyped && now - (data.lastTyped as Timestamp).toMillis() < 10000) {
             typers.push({ userId: docSnap.id, displayName: data.displayName });
           }
        }
      });
      setTypingUsers(typers);
    });

    return () => {
      unsubscribe();
      unsubscribeTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [channelId, user]);

  const handleKeyboardInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!user) return;
    
    setDoc(doc(db, `channels/${channelId}/typing`, user.uid), {
      isTyping: true,
      displayName: userProfileName() || user.email?.split('@')[0] || 'User',
      lastTyped: serverTimestamp()
    }).catch(console.error);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      deleteDoc(doc(db, `channels/${channelId}/typing`, user.uid)).catch(console.error);
    }, 2500);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onShowAuth();
      return;
    }
    
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (user) {
      deleteDoc(doc(db, `channels/${channelId}/typing`, user.uid)).catch(() => {});
    }

    setNewMessage('');
    scrollToBottom();

    try {
      await addDoc(collection(db, `channels/${channelId}/messages`), {
        text: messageText,
        userId: user.uid,
        displayName: userProfileName() || user.email?.split('@')[0] || 'User',
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
      handleFirestoreError(error, OperationType.CREATE, `channels/${channelId}/messages`);
    }
  };

  // Helper to get display name from local storage or fallback, better to pass this via props but we can just ask firebase if needed. Let's just use email split for now until we have proper user profile prop
  const userProfileName = () => {
     // fallback
     return user?.email?.split('@')[0] || 'User';
  }

  return (
    <div className="flex flex-col bg-zinc-900 border border-gray-800 rounded-xl overflow-hidden h-[400px]">
      <div className="bg-black p-3 border-b border-gray-800 flex justify-between items-center shrink-0">
        <h3 className="font-bold text-gray-200 uppercase tracking-widest text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Live Chat
        </h3>
        <span className="text-xs text-gray-500">{messages.length} msgs</span>
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto min-h-0 space-y-3 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-sm text-gray-500 italic">
            No messages yet. Be the first to chat!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`text-sm ${msg.userId === user?.uid ? 'text-right' : 'text-left'}`}>
              <span className={`font-bold text-xs ${msg.userId === user?.uid ? 'text-red-400' : 'text-gray-400'}`}>
                {msg.displayName}
              </span>
              <p className={`inline-block px-3 py-1.5 rounded-lg mt-1 max-w-[85%] text-left ${msg.userId === user?.uid ? 'bg-red-600/20 text-gray-200 border border-red-900/30' : 'bg-black text-gray-300 border border-gray-800'}`}>
                {msg.text}
              </p>
            </div>
          ))
        )}
        {typingUsers.length > 0 && (
          <div className="text-xs text-gray-500 italic mt-2 animate-pulse">
            {typingUsers.map(t => t.displayName).join(', ')} {typingUsers.length === 1 ? 'is typing...' : 'are typing...'}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-black border-t border-gray-800 shrink-0">
        {user ? (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={handleKeyboardInput}
              placeholder="Chat as..."
              className="flex-1 bg-zinc-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              maxLength={200}
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <button 
            onClick={onShowAuth}
            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" /> Sign in to chat
          </button>
        )}
      </div>
{/* Just a tiny global style for scrollbar since there's no index.css handy */}
<style>{`
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #3f3f46;
    border-radius: 20px;
  }
`}</style>
    </div>
  );
}
