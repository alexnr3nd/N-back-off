/* File: src/components/dashboard/DynamicModeExplainer.js */
/* Inline expandable card explaining how Dynamic training mode works */

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle, faTimes } from '@fortawesome/free-solid-svg-icons';

const STORAGE_KEY = 'dynamicModeExplainerSeen';

const getHasBeenSeen = () => {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
  catch { return false; }
};

const setAsSeen = () => {
  try { localStorage.setItem(STORAGE_KEY, 'true'); }
  catch { /* localStorage unavailable */ }
};

const GRADIENT_STYLE = {
  background: 'linear-gradient(to right, #EAB308 0%, #EAB308 33%, #A855F7 33%, #A855F7 66%, #06B6D4 66%, #06B6D4 100%)'
};

const DynamicModeExplainer = ({ isActive }) => {
  const [hasBeenSeen, setHasBeenSeen] = useState(getHasBeenSeen);
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);

  if (!isActive) return null;

  const isExpanded = !hasBeenSeen || isManuallyExpanded;

  const handleDismiss = () => {
    setAsSeen();
    setHasBeenSeen(true);
    setIsManuallyExpanded(false);
  };

  const handleToggle = () => {
    setIsManuallyExpanded(prev => !prev);
  };

  if (isExpanded) {
    return (
      <div className="mt-2">
        <div
          id="dynamic-explainer-content"
          className="border border-theme-accent/20 bg-theme-accent/10 p-3 sm:p-4 expand-row motion-reduce:!animate-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-theme-text">
                How Dynamic Mode Works
              </span>
              <div className="h-0.5 mt-1 rounded-full" style={GRADIENT_STYLE} />
            </div>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="p-2 -m-2 text-theme-text-muted hover:text-theme-text transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} className="h-3 w-3" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs font-mono text-theme-text-secondary mb-3 leading-relaxed">
            Progresses through all three modes within each N-back level: <span className="text-yellow-400">Dual</span> 2.00 → <span className="text-yellow-400">Dual</span> 2.99 → <span className="text-purple-400">Triple</span> 2.00 → <span className="text-purple-400">Triple</span> 2.99 → <span className="text-cyan-400">Quad</span> 2.00 → <span className="text-cyan-400">Quad</span> 2.99 → <span className="text-yellow-400">Dual</span> 3.00, building across all modalities before increasing the level.
          </p>

          {/* Got it button */}
          <div className="flex justify-end">
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-xs font-mono text-theme-bg bg-theme-accent hover:bg-theme-accent-hover transition-colors min-h-[44px]"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Collapsed state — clickable one-liner with chevron
  return (
    <div className="mt-2 text-center">
      <button
        onClick={handleToggle}
        aria-expanded={false}
        aria-controls="dynamic-explainer-content"
        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-theme-text-muted hover:text-theme-text-secondary transition-colors min-h-[44px]"
      >
        <span>Dual → Triple → Quad Progressive</span>
        <FontAwesomeIcon
          icon={faInfoCircle}
          className="h-3 w-3 opacity-60"
        />
      </button>
    </div>
  );
};

export default DynamicModeExplainer;
