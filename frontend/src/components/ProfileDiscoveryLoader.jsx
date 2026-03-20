import { useState, useEffect } from 'react';

const DISCOVERY_MESSAGES = [
  'Analyzing industry patterns...',
  'Calibrating valuation metrics...',
  'Mapping competitive landscape...',
  'Building analysis framework...',
  'Setting up evaluation criteria...',
];

export default function ProfileDiscoveryLoader({ symbol, isDiscovery = true }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % DISCOVERY_MESSAGES.length);
    }, 2400);
    return () => clearInterval(msgTimer);
  }, []);

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(dotTimer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      {/* Animated chart visualization */}
      <div className="relative w-24 h-24">
        {/* Outer ring - slow spin */}
        <div
          className="absolute inset-0 rounded-full border-2 border-violet-500/20"
          style={{ animation: 'discovery-spin 8s linear infinite' }}
        />

        {/* Middle ring - medium spin */}
        <div
          className="absolute inset-2 rounded-full border-2 border-violet-400/30 border-dashed"
          style={{ animation: 'discovery-spin 5s linear infinite reverse' }}
        />

        {/* Inner pulsing core */}
        <div className="absolute inset-4 flex items-center justify-center">
          <div
            className="w-full h-full rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center"
            style={{ animation: 'discovery-pulse 2s ease-in-out infinite' }}
          >
            {/* Chart bars animation */}
            <div className="flex items-end gap-[3px] h-8">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-[4px] rounded-full bg-gradient-to-t from-violet-600 to-purple-400"
                  style={{
                    animation: `discovery-bar 1.2s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Orbiting dots */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{ animation: `discovery-spin ${3 + i}s linear infinite` }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-500"
              style={{
                opacity: 0.3 + i * 0.2,
                animation: `discovery-pulse ${1.5 + i * 0.3}s ease-in-out infinite`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Text content */}
      <div className="flex flex-col items-center gap-2 max-w-xs text-center">
        <h3 className="text-base font-semibold text-foreground">
          {isDiscovery ? `Discovering ${symbol}` : `Analyzing ${symbol}`}{dots}
        </h3>
        <p
          className="text-sm text-muted-foreground font-medium h-5"
          style={{ animation: 'discovery-fade 2.4s ease-in-out infinite' }}
        >
          {DISCOVERY_MESSAGES[messageIndex]}
        </p>
        {isDiscovery && (
          <p className="text-xs text-muted-foreground/60 mt-1">
            First-time analysis — building a custom profile for future use
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1 rounded-full bg-violet-500/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500"
          style={{ animation: 'discovery-progress 3s ease-in-out infinite' }}
        />
      </div>

      <style>{`
        @keyframes discovery-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes discovery-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes discovery-bar {
          0%, 100% { height: 8px; }
          50% { height: 24px; }
        }
        @keyframes discovery-fade {
          0%, 100% { opacity: 0.5; }
          20%, 80% { opacity: 1; }
        }
        @keyframes discovery-progress {
          0% { width: 0%; margin-left: 0; }
          50% { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
