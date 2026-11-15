/* src/components/settings/sections/TrainingLevelSettings.js */
/* Updated: Added game mode selector for Dual/Triple/Quad N-Back */
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSlidersH, faLock } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import {
    SectionCard,
    DropdownInput,
    SliderInput,
    SaveButtonArea,
    StatusMessage,
    ToggleSwitch
} from '../SettingSectionComponents';
import { DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS } from '../../../constants/gameConstants';

// Mode definitions matching ModeSelector.js
const MODES = [
    { key: 'dual', label: 'Dual', description: 'Position + Audio' },
    { key: 'triple', label: 'Triple', description: 'Position + Audio + Color' },
    { key: 'quad', label: 'Quad', description: 'Position + Audio + Color + Shape' },
    { key: 'dynamic', label: 'Dynamic', description: 'Dual → Triple → Quad Progressive' },
];

const DYNAMIC_SUB_MODES = [
    { key: 'dual', label: 'Dual' },
    { key: 'triple', label: 'Triple' },
    { key: 'quad', label: 'Quad' },
];

const FREE_TIER_SLIDER_STEPS_GRANDFATHERED = [0, 25, 50, 75, 99];
const FREE_TIER_SLIDER_STEPS_NEW = [0, 50];

const TrainingLevelSettings = ({
    hasProfile, // Boolean indicating if user data is ready
    selectedMode = 'dual', // Currently selected mode for editing
    onModeChange, // Callback when mode changes
    localNBack,
    onNBackChange,
    nBackOptions,
    localDifficultySliderValue,
    onDifficultySliderChange,
    displayedCombinedLevel,
    isLevelSectionDisabled,
    levelValidationError,
    isSavingLevel,
    levelSaveStatus,
    onRequestLevelChange,
    isFreeTier = false,
    isGrandfathered = false,
    difficultyAdjustmentRange = 'standard',
    onDifficultyAdjustmentRangeChange,
    isPro = false,
    // Dynamic mode props
    dynamicSubMode = 'dual',
    onDynamicSubModeChange,
    // Classic mode props
    hasClassicAccess = true,
    classicAutoLevel = true,
    onClassicAutoLevelChange,
    // Adaptive/Dynamic mode props
    adaptiveAutoLevel = true,
    onAdaptiveAutoLevelChange,
}) => {
    const freeTierSliderSteps = isGrandfathered ? FREE_TIER_SLIDER_STEPS_GRANDFATHERED : FREE_TIER_SLIDER_STEPS_NEW;
    const [localRange, setLocalRange] = useState(difficultyAdjustmentRange);
    const [isSavingRange, setIsSavingRange] = useState(false);
    const [rangeSaved, setRangeSaved] = useState(false);

    useEffect(() => {
        setLocalRange(difficultyAdjustmentRange);
    }, [difficultyAdjustmentRange]);

    const handleSaveRange = async () => {
        if (localRange === difficultyAdjustmentRange) return;
        setIsSavingRange(true);
        await onDifficultyAdjustmentRangeChange?.(localRange);
        setIsSavingRange(false);
        setRangeSaved(true);
        setTimeout(() => setRangeSaved(false), 2000);
    };

    const handleModeClick = (modeKey) => {
        if (!isLevelSectionDisabled && modeKey !== selectedMode && onModeChange) {
            onModeChange(modeKey);
        }
    };
    return (
        <SectionCard>
            {!hasProfile ? (
                <p className="text-sm text-theme-text-muted font-mono italic">
                    No active profile. Unable to adjust training level.
                </p>
            ) : (
                <>
                    {/* Info Banner */}
                    <div className="bg-theme-bg-secondary border border-theme-line rounded-lab p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <FontAwesomeIcon icon={faSlidersH} className="h-5 w-5 text-theme-text-muted flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-mono text-theme-text-secondary">
                                    Adjust Your Training Level
                                </p>
                                <p className="text-xs font-mono text-theme-text-muted mt-1">
                                    Set your preferred starting point. The system will continue adapting from here based on your performance.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mode Selector */}
                    <div className="mb-6">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-charcoal-line" />
                            <span className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                                Training Mode
                            </span>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-charcoal-line" />
                        </div>

                        <div className="flex justify-center">
                            <div className="tab-pill-group inline-flex bg-theme-bg-elevated border border-theme-line">
                                {MODES.map((mode, index) => {
                                    const isActive = selectedMode === mode.key;
                                    const isFirst = index === 0;

                                    return (
                                        <button
                                            key={mode.key}
                                            onClick={() => handleModeClick(mode.key)}
                                            disabled={isLevelSectionDisabled}
                                            className={`
                                                relative px-4 py-2.5 sm:px-6 sm:py-3
                                                text-sm font-mono uppercase tracking-wider
                                                transition-all duration-200
                                                ${!isFirst ? 'border-l border-theme-line' : ''}
                                                ${isActive
                                                    ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/30'
                                                    : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'
                                                }
                                                ${isLevelSectionDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                                focus:outline-none focus:ring-1 focus:ring-theme-accent/50
                                            `}
                                            title={mode.description}
                                        >
                                            <span>{mode.label}</span>
                                            {isActive && (
                                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="hidden sm:block mt-2 text-center">
                            <span className="text-xs font-mono text-theme-text-muted">
                                {MODES.find(m => m.key === selectedMode)?.description || 'Position + Audio'}
                            </span>
                        </div>
                    </div>

                    {/* Dynamic Sub-Mode Selector */}
                    {selectedMode === 'dynamic' && (
                        <div className="mb-6">
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-charcoal-line" />
                                <span className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                                    Mode
                                </span>
                                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-charcoal-line" />
                            </div>

                            <div className="flex justify-center">
                                <div className="tab-pill-group inline-flex bg-theme-bg-elevated border border-theme-line">
                                    {DYNAMIC_SUB_MODES.map((mode, index) => {
                                        const isActive = dynamicSubMode === mode.key;
                                        const isFirst = index === 0;

                                        return (
                                            <button
                                                key={mode.key}
                                                onClick={() => !isLevelSectionDisabled && onDynamicSubModeChange?.(mode.key)}
                                                disabled={isLevelSectionDisabled}
                                                className={`
                                                    relative px-4 py-2.5 sm:px-6 sm:py-3
                                                    text-sm font-mono uppercase tracking-wider
                                                    transition-all duration-200
                                                    ${!isFirst ? 'border-l border-theme-line' : ''}
                                                    ${isActive
                                                        ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/30'
                                                        : 'text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-bg-surface'
                                                    }
                                                    ${isLevelSectionDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                                    focus:outline-none focus:ring-1 focus:ring-theme-accent/50
                                                `}
                                            >
                                                <span>{mode.label}</span>
                                                {isActive && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {/* N-Back Dropdown */}
                        <DropdownInput
                            label="N-Back Level"
                            id="nBackLevel"
                            value={localNBack}
                            onChange={onNBackChange}
                            options={nBackOptions}
                            disabled={isLevelSectionDisabled}
                        />

                        {/* Difficulty Slider */}
                        <SliderInput
                            label="Level Difficulty"
                            id="difficultyLevel"
                            value={String(localDifficultySliderValue)}
                            onChange={isFreeTier ? (e) => {
                                // Snap to nearest free-tier step
                                const raw = parseInt(e.target.value, 10);
                                const nearest = freeTierSliderSteps.reduce((prev, curr) =>
                                    Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
                                );
                                onDifficultySliderChange({ target: { value: String(nearest) } });
                            } : onDifficultySliderChange}
                            min="0"
                            max="99"
                            step="1"
                            disabled={isLevelSectionDisabled}
                            displayValue={displayedCombinedLevel}
                        />

                        {/* Free tier upsell */}
                        {isFreeTier && (
                            <p className="text-[0.6875rem] font-mono text-theme-text-muted mt-1">
                                Free tier: {isGrandfathered ? '5' : '2'} difficulty levels per N-Back.{' '}
                                <Link to="/subscribe" className="text-theme-accent hover:underline">
                                    Unlock 100 levels →
                                </Link>
                            </p>
                        )}
                    </div>

                    {levelValidationError && (
                        <p className="mt-4 text-sm text-neural-synapse font-mono">
                            {levelValidationError}
                        </p>
                    )}

                    <SaveButtonArea>
                        {levelSaveStatus.message && (
                            <StatusMessage status={levelSaveStatus} />
                        )}
                        <button
                            onClick={onRequestLevelChange}
                            disabled={isLevelSectionDisabled || !!levelValidationError}
                            className="px-5 py-2.5 bg-neural-synapse/20 hover:bg-neural-synapse/30 text-neural-synapse
                                border border-neural-synapse/50 rounded-lab text-sm font-mono uppercase tracking-wider
                                disabled:opacity-50 disabled:cursor-not-allowed
                                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-neural-synapse
                                transition-all duration-200 flex items-center justify-center min-w-[140px]"
                        >
                            {isSavingLevel ? (
                                <>
                                    <FontAwesomeIcon icon={faSpinner} className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    Saving...
                                </>
                            ) : (
                                'Update Level'
                            )}
                        </button>
                    </SaveButtonArea>

                    {/* Progression Speed Section */}
                    <div className="mt-6">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-charcoal-line" />
                            <span className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                                Progression Speed
                            </span>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-charcoal-line" />
                        </div>

                        <div className="space-y-2">
                            {DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS.map((option) => {
                                const isSelected = localRange === option.key;
                                const isDisabled = !isPro;

                                return (
                                    <button
                                        key={option.key}
                                        onClick={() => !isDisabled && setLocalRange(option.key)}
                                        disabled={isDisabled || isLevelSectionDisabled}
                                        className={`
                                            w-full text-left px-4 py-3 border transition-all duration-200
                                            ${isSelected
                                                ? 'border-theme-accent/50 bg-theme-accent/10'
                                                : 'border-theme-line bg-theme-bg-elevated hover:bg-theme-bg-surface'
                                            }
                                            ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className={`text-sm font-mono font-medium ${
                                                    isSelected ? 'text-theme-accent' : 'text-theme-text-secondary'
                                                }`}>
                                                    {option.label}
                                                </span>
                                                <p className="text-xs font-mono text-theme-text-secondary mt-0.5">
                                                    {option.description} · {option.detail}
                                                </p>
                                            </div>
                                            {isDisabled && !isSelected && (
                                                <FontAwesomeIcon icon={faLock} className="w-3 h-3 text-theme-text-muted flex-shrink-0" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {!isPro && (
                            <p className="text-[0.6875rem] font-mono text-theme-text-muted mt-2">
                                Progression speed is a Pro feature.{' '}
                                <Link to="/subscribe" className="text-theme-accent hover:underline">
                                    Upgrade →
                                </Link>
                            </p>
                        )}

                        {isPro && localRange !== difficultyAdjustmentRange && (
                            <div className="mt-3 flex justify-end">
                                <button
                                    onClick={handleSaveRange}
                                    disabled={isSavingRange}
                                    className="px-5 py-2.5 bg-neural-synapse/20 hover:bg-neural-synapse/30 text-neural-synapse
                                        border border-neural-synapse/50 rounded-lab text-sm font-mono uppercase tracking-wider
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-neural-synapse
                                        transition-all duration-200 flex items-center justify-center min-w-[140px]"
                                >
                                    {isSavingRange ? (
                                        <>
                                            <FontAwesomeIcon icon={faSpinner} className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Speed'
                                    )}
                                </button>
                            </div>
                        )}

                        {rangeSaved && (
                            <p className="mt-2 text-xs font-mono text-neural-dendrite text-center">
                                Progression speed updated.
                            </p>
                        )}
                    </div>
                </>
            )}

            {/* Adaptive Training Section */}
            <div className="mt-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-charcoal-line" />
                    <span className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                        Adaptive Training
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-charcoal-line" />
                </div>
                <ToggleSwitch
                    label="Auto Level Adjustment"
                    description="When off, your level stays fixed after each session — adjust it yourself on the results screen. Applies to Adaptive and Dynamic training."
                    checked={adaptiveAutoLevel}
                    onChange={(val) => onAdaptiveAutoLevelChange?.(val)}
                    disabled={isLevelSectionDisabled}
                />
            </div>

            {/* Classic Training Section — hidden for cohorts that cannot play Classic */}
            {hasClassicAccess && (
                <div className="mt-6">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-charcoal-line" />
                        <span className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            Classic Training
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-charcoal-line" />
                    </div>
                    <ToggleSwitch
                        label="Auto Level Adjustment"
                        description="When off, your level stays fixed after each session. You choose when to move up or down."
                        checked={classicAutoLevel}
                        onChange={(val) => onClassicAutoLevelChange?.(val)}
                        disabled={isLevelSectionDisabled}
                    />
                </div>
            )}

        </SectionCard>
    );
};

export default TrainingLevelSettings;
