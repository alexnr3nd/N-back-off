/* src/components/tutorial/SectionHub.js */
/* Protocol Guide - Table of Contents Hub */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faArrowRight, faRedo, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { TUTORIAL_SECTIONS } from './tutorialSections';

/**
 * SectionHub - Table of Contents view for Protocol Guide
 * Shows all sections with completion status and navigation
 */
const SectionHub = ({ sections = TUTORIAL_SECTIONS, completedSections = [], onSelectSection, onCheckSection, onUncheckSection, onStartDashboardTour, onClose }) => {

  // Separate main sections from dashboard tour
  const mainSections = sections.filter(s => !s.isExternal);
  const dashboardTourSection = sections.find(s => s.isExternal);

  // Check if all main sections are complete
  const allMainComplete = mainSections.every(s => completedSections.includes(s.id));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="text-center py-6 px-4 border-b border-theme-line">
        <h1 className="text-2xl sm:text-3xl font-serif text-theme-text mb-2">
          Protocol Guide
        </h1>
        <p className="text-sm text-theme-text-secondary font-mono">
          Interactive training orientation
        </p>
      </header>

      {/* Section List */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-md mx-auto space-y-3">
          {mainSections.map((section, index) => {
            const isCompleted = completedSections.includes(section.id);
            const isNext = !isCompleted &&
              (index === 0 || completedSections.includes(mainSections[index - 1]?.id));

            return (
              <SectionRow
                key={section.id}
                section={section}
                isCompleted={isCompleted}
                isNext={isNext}
                onSelect={() => onSelectSection(section.id)}
                onToggleCheck={() => isCompleted
                  ? onUncheckSection?.(section.id)
                  : onCheckSection?.(section.id)
                }
              />
            );
          })}

          {/* Divider */}
          <div className="border-t border-theme-line my-4" />

          {/* Dashboard Tour - Special row */}
          {dashboardTourSection && (
            <SectionRow
              section={dashboardTourSection}
              isCompleted={completedSections.includes(dashboardTourSection.id)}
              isNext={allMainComplete && !completedSections.includes(dashboardTourSection.id)}
              isExternal={true}
              onSelect={onStartDashboardTour}
              onToggleCheck={() => completedSections.includes(dashboardTourSection.id)
                ? onUncheckSection?.(dashboardTourSection.id)
                : onCheckSection?.(dashboardTourSection.id)
              }
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-4 border-t border-theme-line">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <span className="text-xs text-theme-text-muted font-mono">
            {completedSections.length} / {sections.length} complete
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono text-theme-text-muted
              hover:text-theme-text transition-colors"
          >
            Close
          </button>
        </div>
      </footer>
    </div>
  );
};

/**
 * SectionRow - Individual section item in the list
 */
const SectionRow = ({ section, isCompleted, isNext, isExternal, onSelect, onToggleCheck }) => {
  const handleCheckClick = (e) => {
    e.stopPropagation();
    onToggleCheck?.();
  };

  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center gap-4 p-4 text-left
        border rounded-lab transition-all
        ${isCompleted
          ? 'border-theme-line bg-theme-bg-secondary/50'
          : isNext
            ? 'border-theme-accent/50 bg-theme-accent/5 hover:bg-theme-accent/10'
            : 'border-theme-line bg-theme-bg-secondary hover:border-theme-line/80'
        }
      `}
    >
      {/* Checkbox */}
      <div
        onClick={handleCheckClick}
        className={`
          flex items-center justify-center w-5 h-5
          border-2 rounded flex-shrink-0 transition-all
          ${isCompleted
            ? 'border-neural-dendrite bg-neural-dendrite hover:bg-neural-dendrite/80 cursor-pointer'
            : 'border-theme-line bg-transparent hover:border-warm-muted cursor-pointer'
          }
        `}
        title={isCompleted ? 'Click to uncheck' : 'Click to mark complete'}
      >
        {isCompleted && (
          <FontAwesomeIcon
            icon={faCheck}
            className="h-3 w-3 text-theme-bg"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className={`
          text-sm font-mono uppercase tracking-wider
          ${isCompleted ? 'text-theme-text-muted' : 'text-theme-text'}
        `}>
          {section.title}
        </h3>
        <p className="text-xs text-theme-text-muted font-mono mt-0.5 truncate">
          {section.description}
        </p>
      </div>

      {/* Action */}
      <div className="flex-shrink-0">
        {isCompleted ? (
          <span className="flex items-center gap-1 text-xs text-theme-text-muted font-mono">
            <FontAwesomeIcon icon={faRedo} className="h-3 w-3" />
            <span className="hidden sm:inline">Review</span>
          </span>
        ) : isNext ? (
          <span className="flex items-center gap-1 text-xs text-theme-accent font-mono">
            {isExternal ? (
              <>
                <span>Start</span>
                <FontAwesomeIcon icon={faExternalLinkAlt} className="h-3 w-3" />
              </>
            ) : (
              <>
                <span>Start</span>
                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
              </>
            )}
          </span>
        ) : null}
      </div>
    </button>
  );
};

export default SectionHub;
