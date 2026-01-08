
import React from 'react';

interface VoiceVisualizerProps {
  isActive: boolean;
  color?: string;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isActive, color = 'bg-blue-500' }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className={`${color} w-1.5 rounded-full transition-all duration-150 ${
            isActive ? 'animate-bounce' : 'h-2'
          }`}
          style={{
            animationDelay: `${i * 0.1}s`,
            height: isActive ? `${Math.random() * 40 + 10}px` : '8px'
          }}
        />
      ))}
    </div>
  );
};

export default VoiceVisualizer;
