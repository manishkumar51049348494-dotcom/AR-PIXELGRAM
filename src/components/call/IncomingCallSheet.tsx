// आने वाली कॉल की notification sheet
import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import type { CallRecord } from './CallScreen';
import type { Profile } from '@/types/types';

interface IncomingCallSheetProps {
  call: CallRecord;
  callerProfile: Profile;
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallSheet: React.FC<IncomingCallSheetProps> = ({
  call, callerProfile, onAccept, onReject,
}) => {
  return (
    <div className="fixed inset-0 z-[99] flex items-end justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg mx-auto mb-0">
        <div
          className="rounded-t-3xl shadow-2xl px-6 pt-6 pb-10 flex flex-col items-center gap-5"
          style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 100%)' }}
        >
          {/* Pulsing ring around avatar */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping scale-110" />
            {callerProfile.avatar_url ? (
              <img src={callerProfile.avatar_url} alt="" className="relative w-20 h-20 rounded-full object-cover ring-4 ring-green-400/50" />
            ) : (
              <div className="relative w-20 h-20 rounded-full bg-primary/40 flex items-center justify-center ring-4 ring-green-400/50">
                <span className="text-white font-black text-3xl">{callerProfile.username?.[0]?.toUpperCase()}</span>
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="text-white/60 text-sm mb-1">
              {call.call_type === 'video' ? '📹 Video Call' : '📞 Voice Call'} आ रही है
            </p>
            <h3 className="text-white font-bold text-xl">{callerProfile.full_name || callerProfile.username}</h3>
            <p className="text-white/50 text-sm">@{callerProfile.username}</p>
          </div>

          {/* Accept / Reject */}
          <div className="flex items-center gap-16 mt-2">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onReject}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 active:scale-95 transition-transform"
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <span className="text-white/60 text-xs">अस्वीकार</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onAccept}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/40 active:scale-95 transition-transform animate-bounce"
              >
                {call.call_type === 'video'
                  ? <Video className="w-7 h-7 text-white" />
                  : <Phone className="w-7 h-7 text-white" />}
              </button>
              <span className="text-white/60 text-xs">स्वीकार</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallSheet;
