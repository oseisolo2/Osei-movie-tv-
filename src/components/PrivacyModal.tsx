import { X } from 'lucide-react';

interface PrivacyModalProps {
  onClose: () => void;
}

export default function PrivacyModal({ onClose }: PrivacyModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl relative flex flex-col">
        <div className="flex-shrink-0 p-6 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Privacy Policy</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow text-gray-300 text-sm space-y-4">
          <p className="opacity-80">Last Updated: {new Date().toLocaleDateString()}</p>
          
          <h3 className="text-white font-bold text-base pt-2">1. Information We Collect</h3>
          <p>
            When you use our services, we may collect the following types of information:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account Information:</strong> When you create an account, we collect your email address, profile name, and authentication tokens provided by third parties (like Google).</li>
            <li><strong>Usage Data:</strong> We collect data regarding how you use the application, including which channels you mark as favorites, your viewing history, and interaction preferences.</li>
            <li><strong>Device Information:</strong> We may collect information about your browser, operating system, and IP address to provide a better streaming experience.</li>
          </ul>

          <h3 className="text-white font-bold text-base pt-2">2. How We Use Your Information</h3>
          <p>
            We use the information we collect for various purposes, including to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide, maintain, and improve our services.</li>
            <li>Personalize your experience (e.g., saving your favorite channels and auto-play settings).</li>
            <li>Monitor and analyze usage trends and activities.</li>
            <li>Detect, investigate, and prevent security incidents and other malicious or illegal activities.</li>
          </ul>

          <h3 className="text-white font-bold text-base pt-2">3. Storage and Security</h3>
          <p>
            Your account information and preferences are securely stored using Firebase. We implement modern security measures designed to protect your personal information from unauthorized access and disclosure. However, no internet-based service can be 100% secure.
          </p>

          <h3 className="text-white font-bold text-base pt-2">4. Third-Party Services</h3>
          <p>
            We may use third-party services (such as YouTube or external streaming links) within the app. These third parties have their own privacy policies. We are not responsible for the privacy practices of these third parties.
          </p>

          <h3 className="text-white font-bold text-base pt-2">5. Changes to This Policy</h3>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
          </p>

          <br />
          <p className="text-center font-medium opacity-60">End of Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}
