// src/components/game/FeatureIntroMessage.js
import React from 'react';

const FeatureIntroMessage = ({ message }) => {
  if (!message) return null;

  return (
    <div className="bg-theme-accent/10 border-l-4 border-theme-accent p-3 mb-4">
      <div className="flex items-start">
        <div className="text-theme-accent mr-2">✨</div>
        <div className="text-theme-text-secondary">{message}</div>
      </div>
    </div>
  );
};

export default FeatureIntroMessage;
