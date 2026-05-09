import React from 'react';
import { X } from 'lucide-react';

interface CopyrightModalProps {
  onClose: () => void;
}

const CopyrightModal: React.FC<CopyrightModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/50">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">Copyright Information</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar text-sm text-gray-300 space-y-6">
          <section>
            <h3 className="text-lg font-bold text-white mb-2 pb-1 border-b border-gray-800">1. Ownership of Content</h3>
            <p>
              The application, including its original content, features, and functionality, are owned by Osei TV and are protected by international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-white mb-2 pb-1 border-b border-gray-800">2. Third-Party Streams</h3>
            <p>
              This application functions purely as a player. We do not host, upload, or manage the streams provided within the app. All media streams, logos, and trademarks remain the property of their respective owners. We merely aggregate publicly available streaming links for convenience.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-white mb-2 pb-1 border-b border-gray-800">3. DMCA & Copyright Claims</h3>
            <p>
              Osei TV respects the intellectual property rights of others. If you believe that your copyrighted work has been copied in a way that constitutes copyright infringement and is accessible via this application, please notify our copyright agent.
            </p>
            <p className="mt-2 text-gray-400 italic">
              When submitting a claim, please provide complete URL links, proof of ownership, and physical/electronic signatures to expedite the process.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-white mb-2 pb-1 border-b border-gray-800">4. Removal Requests</h3>
            <p>
              If you are the legal owner of any content displayed here and wish to have it removed, please contact us immediately. We will comply with all valid removal requests within 48 hours of verification.
            </p>
          </section>
        </div>

        <div className="p-4 border-t border-gray-800 bg-black/50 text-center">
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Osei TV. All Rights Reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default CopyrightModal;
