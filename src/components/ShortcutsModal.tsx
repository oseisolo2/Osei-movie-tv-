import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  onClose: () => void;
}

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const shortcuts = [
    { key: "Space or K", action: "Play / Pause" },
    { key: "M", action: "Mute / Unmute" },
    { key: "F", action: "Toggle Fullscreen" },
    { key: "Up / Down", action: "Volume Up / Down" },
    { key: "Left / P", action: "Previous Channel" },
    { key: "Right / N", action: "Next Channel" },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-gray-800 flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-full">
            <Keyboard className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Keyboard Shortcuts</h2>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {shortcuts.map((shortcut, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-gray-400">{shortcut.action}</span>
                <span className="bg-black border border-gray-700 text-gray-300 px-3 py-1.5 rounded-md font-mono text-xs font-bold shadow-inner">
                  {shortcut.key}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
