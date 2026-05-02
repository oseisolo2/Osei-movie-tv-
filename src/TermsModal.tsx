import { X } from 'lucide-react';

interface TermsModalProps {
  onClose: () => void;
}

export default function TermsModal({ onClose }: TermsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl relative flex flex-col">
        <div className="flex-shrink-0 p-6 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Terms of Service</h2>
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
          
          <h3 className="text-white font-bold text-base pt-2">1. Acceptance of Terms</h3>
          <p>
            By accessing and using Osei TV ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. 
            In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.
          </p>

          <h3 className="text-white font-bold text-base pt-2">2. Description of Service</h3>
          <p>
            Osei TV provides users with access to a rich collection of resources, including various communications tools, 
            search services, streaming capabilities, and personalized content. You understand and agree that the Service 
            may include advertisements and that these advertisements are necessary for Osei TV to provide the Service.
          </p>

          <h3 className="text-white font-bold text-base pt-2">3. User Conduct</h3>
          <p>
            You agree to not use the Service to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Upload, post, email, transmit or otherwise make available any content that is unlawful, harmful, threatening, abusive, harassing, or defamatory.</li>
            <li>Impersonate any person or entity, or falsely state or otherwise misrepresent your affiliation with a person or entity.</li>
            <li>Forge headers or otherwise manipulate identifiers in order to disguise the origin of any content transmitted through the Service.</li>
            <li>Interfere with or disrupt the Service or servers or networks connected to the Service.</li>
          </ul>

          <h3 className="text-white font-bold text-base pt-2">4. Modifications to Service</h3>
          <p>
            Osei TV reserves the right at any time and from time to time to modify or discontinue, temporarily or permanently, 
            the Service (or any part thereof) with or without notice. You agree that Osei TV shall not be liable to you or to 
            any third party for any modification, suspension or discontinuance of the Service.
          </p>

          <h3 className="text-white font-bold text-base pt-2">5. Disclaimer of Warranties</h3>
          <p>
            You expressly understand and agree that your use of the service is at your sole risk. The service is provided on an "AS IS" and "AS AVAILABLE" basis.
          </p>

          <br />
          <p className="text-center font-medium opacity-60">End of Terms of Service</p>
        </div>
      </div>
    </div>
  );
}
