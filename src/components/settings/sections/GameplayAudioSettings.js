/* src/components/settings/sections/GameplayAudioSettings.js */
/* Audio settings: Instant feedback and voice selection */
import React from 'react';
import {
    SectionCard,
    SaveButton,
    SaveButtonArea,
    StatusMessage
} from '../SettingSectionComponents';

const GameplayAudioSettings = ({
    localInstantFeedbackPositive,
    onInstantFeedbackPositiveChange,
    localInstantFeedbackErrors,
    onInstantFeedbackErrorsChange,
    localInstantFeedbackMisses,
    onInstantFeedbackMissesChange,
    localSelectedVoiceId,
    onSelectedVoiceIdChange,
    voiceOptions,
    isGeneralSectionDisabled,
    audioReady,
    onResumeAudio,
    sampleLetters,
    onTestLetter,
    activeButton,
    isSavingAppSettings,
    appSaveStatus,
    onSaveGameplayAudio
}) => {
    return (
        <SectionCard>
            <div className="space-y-2 divide-y divide-theme-line">
                {/* Instant Feedback - Grouped Section */}
                <div className="py-4">
                    {/* Group Header */}
                    <div className="mb-4">
                        <span className="text-sm font-mono text-theme-text">Instant Feedback</span>
                        <span className="block text-xs text-theme-text-muted mt-1 font-mono">
                            Show visual and audio cues after responding to a stimulus.
                        </span>
                    </div>

                    {/* Sub-toggles Container */}
                    <div className="ml-4 space-y-3 border-l-2 border-theme-line pl-4">
                        {/* Positive Feedback Toggle */}
                        <div className="flex items-center justify-between">
                            <span className="flex-grow flex flex-col mr-4">
                                <span className="text-sm font-mono text-theme-text-secondary">Correct Responses</span>
                                <span className="text-xs text-theme-text-muted mt-0.5 font-mono">
                                    Green highlight when you correctly identify a match
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => !isGeneralSectionDisabled && onInstantFeedbackPositiveChange(!localInstantFeedbackPositive)}
                                className={`${
                                    localInstantFeedbackPositive ? 'bg-neural-dendrite' : 'bg-theme-line'
                                } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-neural-dendrite ${
                                    isGeneralSectionDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                role="switch"
                                aria-checked={localInstantFeedbackPositive}
                                disabled={isGeneralSectionDisabled}
                                aria-label="Correct response feedback"
                            >
                                <span
                                    aria-hidden="true"
                                    className={`${
                                        localInstantFeedbackPositive ? 'translate-x-5' : 'translate-x-0'
                                    } pointer-events-none inline-block h-5 w-5 rounded-full bg-theme-bg shadow-lg transform ring-0 transition ease-in-out duration-200`}
                                />
                            </button>
                        </div>

                        {/* Errors Toggle */}
                        <div className="flex items-center justify-between">
                            <span className="flex-grow flex flex-col mr-4">
                                <span className="text-sm font-mono text-theme-text-secondary">Errors</span>
                                <span className="text-xs text-theme-text-muted mt-0.5 font-mono">
                                    Red highlight when you press a key that wasn't a match
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => !isGeneralSectionDisabled && onInstantFeedbackErrorsChange(!localInstantFeedbackErrors)}
                                className={`${
                                    localInstantFeedbackErrors ? 'bg-neural-synapse' : 'bg-theme-line'
                                } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-neural-synapse ${
                                    isGeneralSectionDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                role="switch"
                                aria-checked={localInstantFeedbackErrors}
                                disabled={isGeneralSectionDisabled}
                                aria-label="Error feedback for wrong key presses"
                            >
                                <span
                                    aria-hidden="true"
                                    className={`${
                                        localInstantFeedbackErrors ? 'translate-x-5' : 'translate-x-0'
                                    } pointer-events-none inline-block h-5 w-5 rounded-full bg-theme-bg shadow-lg transform ring-0 transition ease-in-out duration-200`}
                                />
                            </button>
                        </div>

                        {/* Misses Toggle */}
                        <div className="flex items-center justify-between">
                            <span className="flex-grow flex flex-col mr-4">
                                <span className="text-sm font-mono text-theme-text-secondary">Misses</span>
                                <span className="text-xs text-theme-text-muted mt-0.5 font-mono">
                                    Red highlight on the grid tile you should have responded to
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => !isGeneralSectionDisabled && onInstantFeedbackMissesChange(!localInstantFeedbackMisses)}
                                className={`${
                                    localInstantFeedbackMisses ? 'bg-neural-synapse' : 'bg-theme-line'
                                } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-neural-synapse ${
                                    isGeneralSectionDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                role="switch"
                                aria-checked={localInstantFeedbackMisses}
                                disabled={isGeneralSectionDisabled}
                                aria-label="Missed match feedback"
                            >
                                <span
                                    aria-hidden="true"
                                    className={`${
                                        localInstantFeedbackMisses ? 'translate-x-5' : 'translate-x-0'
                                    } pointer-events-none inline-block h-5 w-5 rounded-full bg-theme-bg shadow-lg transform ring-0 transition ease-in-out duration-200`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Audio Output - Grouped Section */}
                <div className="py-4">
                    {/* Group Header */}
                    <div className="mb-4">
                        <span className="text-sm font-mono text-theme-text">Audio Output</span>
                        <span className="block text-xs text-theme-text-muted mt-1 font-mono">
                            Configure voice settings and test audio playback.
                        </span>
                    </div>

                    {/* Sub-items Container */}
                    <div className="ml-4 space-y-4 border-l-2 border-theme-line pl-4">
                        {/* Voice Selection */}
                        <div>
                            <label htmlFor="audioVoice" className="block text-sm font-mono text-theme-text-secondary mb-2">
                                Voice & Language
                            </label>
                            <select
                                id="audioVoice"
                                value={localSelectedVoiceId}
                                onChange={onSelectedVoiceIdChange}
                                disabled={isGeneralSectionDisabled || voiceOptions.length === 0}
                                className="w-full px-4 py-3 bg-theme-bg-secondary border border-theme-line rounded-lab text-theme-text font-mono text-sm transition-all duration-200 hover:border-theme-border focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {voiceOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Audio Test */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-mono text-theme-text-secondary">Test Audio</span>
                                {!audioReady && (
                                    <button
                                        className="px-3 py-1.5 bg-theme-accent/20 text-theme-accent border border-theme-accent/50
                                            rounded-lab text-xs font-mono uppercase tracking-wider
                                            hover:bg-theme-accent/30 transition-colors disabled:opacity-50"
                                        onClick={onResumeAudio}
                                        disabled={isGeneralSectionDisabled}
                                    >
                                        Activate Audio
                                    </button>
                                )}
                            </div>

                            {!audioReady && (
                                <p className="text-xs text-theme-accent/80 mb-3 font-mono">
                                    Click "Activate Audio" first if sounds don't play.
                                </p>
                            )}

                            {/* Grid for testing letters */}
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {sampleLetters.map(letter => (
                                    <button
                                        key={letter}
                                        className={`px-4 py-3 rounded-lab text-sm font-mono uppercase tracking-wider transition-all duration-150 border ${
                                            activeButton === `letter-${letter}`
                                                ? 'bg-theme-accent text-theme-bg border-theme-accent scale-95'
                                                : 'bg-theme-bg-elevated text-theme-text border-theme-line hover:border-theme-accent/50 hover:text-theme-accent'
                                        } ${isGeneralSectionDisabled || !audioReady ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        onClick={() => onTestLetter(letter)}
                                        disabled={isGeneralSectionDisabled || !audioReady}
                                    >
                                        {letter}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <SaveButtonArea>
                {appSaveStatus.section === 'gameplay' && (
                    <StatusMessage status={appSaveStatus} />
                )}
                <SaveButton
                    onClick={onSaveGameplayAudio}
                    disabled={isGeneralSectionDisabled}
                    isSaving={isSavingAppSettings && appSaveStatus.section === 'gameplay'}
                    text="Save"
                    minWidth="120px"
                />
            </SaveButtonArea>
        </SectionCard>
    );
};

export default GameplayAudioSettings;
