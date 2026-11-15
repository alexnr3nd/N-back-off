/* src/components/testing/countingSpan/CountingSpanInstructions.js */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import StimulusDisplay from './StimulusDisplay';
import RecallInterface from './RecallInterface';
import { COUNTING_SPAN_DEFAULTS } from '../../../constants/cstConstants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faArrowLeft,
    faCheckCircle,
    faPlay,
    faCalculator,
    faBrain
} from '@fortawesome/free-solid-svg-icons';

// --- Local Utilities (Minimal & Non-Sensitive) ---

// Simple layout function JUST for placing pre-defined practice items.
const simplePracticeLayout = (itemsToPlace) => {
    const placedItems = [];
    const width = 450;
    const height = 300;
    const padding = 20;

    itemsToPlace.forEach((item, index) => {
        placedItems.push({
            ...item,
            x: Math.random() * (width - 2 * padding) + padding + 25,
            y: Math.random() * (height - 2 * padding) + padding + 25,
            id: `p_item_${Date.now()}_${index}`
        });
    });
    return placedItems;
};

// Local scoring function (simple comparison)
const calculatePracticeScore = (presentedCounts, recalledCounts) => {
    let score = 0;
    const setSize = Array.isArray(presentedCounts) ? presentedCounts.length : 0;
    for (let i = 0; i < setSize; i++) {
        if (recalledCounts && typeof recalledCounts[i] === 'number' && recalledCounts[i] === presentedCounts[i]) {
            score++;
        }
    }
    return score;
};

// --- Fixed Practice Examples Data ---

const PROCESSING_PRACTICE_EXAMPLES = [
    { targetCount: 5, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'greenCircle'}, {type: 'blueSquare'}, {type: 'greenCircle'} ]) },
    { targetCount: 8, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'greenCircle'}, {type: 'blueSquare'}, {type: 'blueSquare'}, {type: 'greenCircle'} ]) },
    { targetCount: 4, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'greenCircle'}, {type: 'greenCircle'}, {type: 'greenCircle'}, {type: 'blueSquare'} ]) },
];

const RECALL_PRACTICE_EXAMPLE_TRIALS = [
    { targetCount: 6, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'greenCircle'}, {type: 'blueSquare'} ]) },
    { targetCount: 3, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'greenCircle'}, {type: 'greenCircle'}, {type: 'blueSquare'} ]) },
    { targetCount: 7, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueSquare'}, {type: 'greenCircle'}, {type: 'blueSquare'} ]) },
    { targetCount: 5, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'greenCircle'}, {type: 'greenCircle'}, {type: 'blueSquare'} ]) },
];
const RECALL_PRACTICE_CORRECT_SEQUENCE = RECALL_PRACTICE_EXAMPLE_TRIALS.map(t => t.targetCount);
const RECALL_PRACTICE_SET_SIZE = RECALL_PRACTICE_EXAMPLE_TRIALS.length;

const INTEGRATED_PRACTICE_EXAMPLE_SET_TRIALS = [
     { targetCount: 4, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'greenCircle'}, {type: 'blueSquare'}, {type: 'greenCircle'} ]) },
     { targetCount: 9, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'greenCircle'}, {type: 'blueSquare'}, {type: 'blueSquare'} ]) },
     { targetCount: 6, items: simplePracticeLayout([ {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'blueCircle'}, {type: 'greenCircle'}, {type: 'blueSquare'} ]) },
];
const INTEGRATED_PRACTICE_CORRECT_SEQUENCE = INTEGRATED_PRACTICE_EXAMPLE_SET_TRIALS.map(t => t.targetCount);
const INTEGRATED_PRACTICE_SET_SIZE = INTEGRATED_PRACTICE_EXAMPLE_SET_TRIALS.length;

// --- Component Definition ---

const CountingSpanInstructions = ({ onStartAssessment }) => {
    // --- State Management ---
    const [step, setStep] = useState('intro1');
    const [practiceSubStep, setPracticeSubStep] = useState('stimulus');
    const [trialNum, setTrialNum] = useState(0);
    const [currentStimulus, setCurrentStimulus] = useState(null);
    const [currentCorrectCount, setCurrentCorrectCount] = useState(null);
    const [recallPracticeJudgments, setRecallPracticeJudgments] = useState([]);
    const [practiceRecallSequence, setPracticeRecallSequence] = useState(Array(RECALL_PRACTICE_SET_SIZE).fill(null));
    const [integratedJudgmentsForSet, setIntegratedJudgmentsForSet] = useState([]);
    const [integratedRecallSequence, setIntegratedRecallSequence] = useState(Array(INTEGRATED_PRACTICE_SET_SIZE).fill(null));
    const [feedback, setFeedback] = useState('');

    // --- Setup Functions for Practice Steps ---
    const setupProcessingPractice = useCallback(() => {
        setTrialNum(0);
        setFeedback('');
        const example = PROCESSING_PRACTICE_EXAMPLES[0];
        setCurrentStimulus(example);
        setCurrentCorrectCount(example.targetCount);
        setPracticeSubStep('judgment');
    }, []);

    const setupRecallPractice = useCallback(() => {
        setTrialNum(0);
        setFeedback('');
        setRecallPracticeJudgments([]);
        setPracticeRecallSequence(Array(RECALL_PRACTICE_SET_SIZE).fill(null));
        const example = RECALL_PRACTICE_EXAMPLE_TRIALS[0];
        setCurrentStimulus(example);
        setCurrentCorrectCount(example.targetCount);
        setPracticeSubStep('judgment');
    }, []);

    const setupIntegratedPracticeSet = useCallback(() => {
        setTrialNum(0);
        setFeedback('');
        setIntegratedJudgmentsForSet([]);
        setIntegratedRecallSequence(Array(INTEGRATED_PRACTICE_SET_SIZE).fill(null));
        const example = INTEGRATED_PRACTICE_EXAMPLE_SET_TRIALS[0];
        setCurrentStimulus(example);
        setCurrentCorrectCount(example.targetCount);
        setPracticeSubStep('judgment');
    }, []);

    // --- Advancement Logic ---
    const handleNextOverallStep = useCallback(() => {
        setFeedback('');
        switch (step) {
            case 'intro1': setStep('intro2'); break;
            case 'intro2':
                setStep('processingPractice');
                setupProcessingPractice();
                break;
            case 'processingPractice_done':
                setStep('recallPractice');
                setupRecallPractice();
                break;
            case 'recallPractice_done':
                setStep('integratedPractice');
                setupIntegratedPracticeSet();
                break;
            case 'integratedPractice_done':
                if (onStartAssessment) onStartAssessment();
                break;
            default: setStep('intro1');
        }
    }, [step, onStartAssessment, setupProcessingPractice, setupRecallPractice, setupIntegratedPracticeSet]);

    const handlePreviousStep = useCallback(() => {
        setFeedback('');
        switch (step) {
            case 'intro2': setStep('intro1'); break;
            default: break;
        }
    }, [step]);

    // --- Handlers for User Actions within Practice Steps ---
    const handlePracticeJudgment = useCallback((isOdd) => {
        const isCorrect = (currentCorrectCount % 2 !== 0) === isOdd;
        let nextSubStep = 'feedback';
        let moreTrials = false;
        let nextMajorStep = null;
        let nextExampleIndex = trialNum + 1;

        setFeedback(`Trial ${trialNum + 1}: Judgment ${isCorrect ? 'Correct!' : 'Incorrect.'} (Count was ${currentCorrectCount})`);
        setPracticeSubStep('feedback');

        if (step === 'processingPractice') {
            moreTrials = nextExampleIndex < PROCESSING_PRACTICE_EXAMPLES.length;
            if (!moreTrials) nextMajorStep = 'processingPractice_done';
        } else if (step === 'recallPractice') {
            setRecallPracticeJudgments(prev => [...prev, { correct: isCorrect }]);
            moreTrials = nextExampleIndex < RECALL_PRACTICE_EXAMPLE_TRIALS.length;
            if (!moreTrials) nextSubStep = 'recall';
        } else if (step === 'integratedPractice') {
            setIntegratedJudgmentsForSet(prev => [...prev, { correct: isCorrect }]);
            moreTrials = nextExampleIndex < INTEGRATED_PRACTICE_EXAMPLE_SET_TRIALS.length;
            if (!moreTrials) nextSubStep = 'recall';
        }

        setTimeout(() => {
            setFeedback('');
            if (moreTrials) {
                setTrialNum(nextExampleIndex);
                let nextExample = null;
                if (step === 'processingPractice') nextExample = PROCESSING_PRACTICE_EXAMPLES[nextExampleIndex];
                else if (step === 'recallPractice') nextExample = RECALL_PRACTICE_EXAMPLE_TRIALS[nextExampleIndex];
                else if (step === 'integratedPractice') nextExample = INTEGRATED_PRACTICE_EXAMPLE_SET_TRIALS[nextExampleIndex];

                if (nextExample) {
                    setCurrentStimulus(nextExample);
                    setCurrentCorrectCount(nextExample.targetCount);
                    setPracticeSubStep('judgment');
                } else {
                     console.error("Error getting next practice example!");
                }
            } else {
                if (nextMajorStep) {
                    setStep(nextMajorStep);
                } else {
                    setPracticeSubStep(nextSubStep);
                }
            }
        }, 1000);

    }, [step, trialNum, currentCorrectCount]);

    // --- Recall Practice Handlers ---
    const handlePracticeRecallChange = useCallback((newSequence) => {
        setPracticeRecallSequence(newSequence);
    }, []);

    const handleRecallPracticeSubmit = useCallback(() => {
        const score = calculatePracticeScore(RECALL_PRACTICE_CORRECT_SEQUENCE, practiceRecallSequence);
        const processingCorrect = recallPracticeJudgments.filter(j => j.correct).length;
        const processingTotal = recallPracticeJudgments.length;
        setFeedback(`Recall Practice Complete: Score ${score}/${RECALL_PRACTICE_SET_SIZE}. Judgments: ${processingCorrect}/${processingTotal}. (Correct sequence: ${RECALL_PRACTICE_CORRECT_SEQUENCE.join(', ')})`);
        setStep('recallPractice_done');
    }, [practiceRecallSequence, recallPracticeJudgments]);

    // --- Integrated Practice Handlers ---
    const handleIntegratedRecallChange = useCallback((newSequence) => {
        setIntegratedRecallSequence(newSequence);
    }, []);

    const handleIntegratedRecallSubmit = useCallback(() => {
        const score = calculatePracticeScore(INTEGRATED_PRACTICE_CORRECT_SEQUENCE, integratedRecallSequence);
        const processingCorrect = integratedJudgmentsForSet.filter(j => j.correct).length;
        const processingTotal = integratedJudgmentsForSet.length;
        setFeedback(`Integrated Practice Set 1 Feedback: Score ${score}/${INTEGRATED_PRACTICE_SET_SIZE}. Judgments: ${processingCorrect}/${processingTotal}. (Recalled: ${integratedRecallSequence.map(n => n ?? '?').join(', ')})`);
        setPracticeSubStep('feedback');

        setTimeout(() => {
             setStep('integratedPractice_done');
        }, 1500);

    }, [integratedRecallSequence, integratedJudgmentsForSet]);

    // --- Render Logic ---
    const renderContent = () => {
        const judgmentWindowSeconds = (COUNTING_SPAN_DEFAULTS.STIMULUS_JUDGMENT_WINDOW_MS || 4500) / 1000;

        // Progress indicator
        const getStepNumber = () => {
            if (step === 'intro1' || step === 'intro2') return 1;
            if (step === 'processingPractice' || step === 'processingPractice_done') return 2;
            if (step === 'recallPractice' || step === 'recallPractice_done') return 3;
            if (step === 'integratedPractice' || step === 'integratedPractice_done') return 4;
            return 1;
        };

        const ProgressIndicator = () => (
            <div className="flex items-center justify-center gap-2 mb-6">
                {[1, 2, 3, 4].map((num) => (
                    <div
                        key={num}
                        className={`h-2 w-8 transition-colors ${
                            num <= getStepNumber() ? 'bg-theme-accent' : 'bg-theme-line'
                        }`}
                    />
                ))}
            </div>
        );

        // --- Render Introduction Steps ---
        if (step === 'intro1') {
            return (
                <div className="p-6 sm:p-8">
                    <ProgressIndicator />
                    <div className="flex items-center justify-center mb-6">
                        <div className="h-14 w-14 bg-theme-bg-elevated border border-theme-accent flex items-center justify-center text-theme-accent">
                            <FontAwesomeIcon icon={faBrain} className="h-6 w-6" />
                        </div>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-serif italic text-theme-text text-center mb-6">Counting Span Task</h2>
                    <div className="text-left space-y-4 text-sm text-theme-text-secondary mb-8">
                        <p>Welcome! This task measures working memory.</p>
                        <p>
                            You will see screens with <span className="text-blue-400 font-semibold">BLUE CIRCLES</span>, green circles, and blue squares.
                        </p>
                        <div className="bg-theme-bg-elevated border border-theme-line p-4 space-y-3">
                            <p><span className="text-theme-accent font-semibold">1. Count:</span> On each screen, count the <span className="text-blue-400 font-semibold">BLUE CIRCLES</span>.</p>
                            <p><span className="text-theme-accent font-semibold">2. Judge:</span> Decide if your count is <span className="text-theme-text font-semibold">Odd or Even</span> and click the corresponding button.</p>
                        </div>
                        <div className="bg-theme-accent/10 border-l-2 border-theme-accent p-4">
                            <p className="text-theme-text-secondary">
                                <span className="text-theme-accent font-semibold">Important:</span> You have a limited time ({judgmentWindowSeconds} seconds) for both counting and judging each screen.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-center">
                        <button
                            onClick={handleNextOverallStep}
                            className="btn-primary-lab py-3 px-6 text-sm flex items-center gap-2"
                        >
                            <span>Next</span>
                            <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            );
        }

        if (step === 'intro2') {
            return (
                <div className="p-6 sm:p-8">
                    <ProgressIndicator />
                    <div className="flex items-center justify-center mb-6">
                        <div className="h-14 w-14 bg-theme-bg-elevated border border-theme-accent flex items-center justify-center text-theme-accent">
                            <FontAwesomeIcon icon={faCalculator} className="h-6 w-6" />
                        </div>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-serif italic text-theme-text text-center mb-6">Remembering the Counts</h2>
                    <div className="text-left space-y-4 text-sm text-theme-text-secondary mb-8">
                        <div className="bg-theme-bg-elevated border border-theme-line p-4 space-y-3">
                            <p><span className="text-theme-accent font-semibold">3. Remember:</span> While counting and judging, you MUST also <span className="text-theme-text font-semibold">remember each blue circle count</span> in the exact order it appeared.</p>
                            <p>
                                For example, if you count 5, then 8, then 4 blue circles, you need to remember the sequence{' '}
                                <code className="text-base font-mono bg-theme-bg-secondary px-2 py-0.5 text-theme-accent">5, 8, 4</code>.
                            </p>
                            <p><span className="text-theme-accent font-semibold">4. Recall:</span> After a few screens (a "set"), you'll see a keypad. Use it to enter the sequence of counts you remembered, in the correct order.</p>
                        </div>
                        <div className="bg-status-error/10 border-l-2 border-status-error p-4">
                            <p className="text-theme-text-secondary">
                                <span className="text-status-error font-semibold">Critical:</span> Accuracy in both counting/judging <span className="text-status-error font-bold">AND</span> recalling the counts in order is essential.
                            </p>
                        </div>
                        <p className="text-theme-text-muted">Let's practice each part.</p>
                    </div>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={handlePreviousStep}
                            className="py-3 px-6 text-sm bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:border-theme-accent hover:text-theme-accent transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
                            <span>Back</span>
                        </button>
                        <button
                            onClick={handleNextOverallStep}
                            className="btn-primary-lab py-3 px-6 text-sm flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlay} className="h-3 w-3" />
                            <span>Start Practice</span>
                        </button>
                    </div>
                </div>
            );
        }

        // --- Render Processing Practice (Step 1) ---
        if (step === 'processingPractice' || step === 'processingPractice_done') {
            const totalTrials = PROCESSING_PRACTICE_EXAMPLES.length;
            return (
                <div className="p-6 sm:p-8">
                    <ProgressIndicator />
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                        <h3 className="text-sm sm:text-xs uppercase tracking-[0.2em] text-theme-text-muted font-mono">Practice 1 of 3</h3>
                    </div>
                    <h3 className="text-lg font-serif italic text-theme-text text-center mb-4">Counting & Judging</h3>

                    {step === 'processingPractice' && (
                        <p className="text-sm text-theme-text-secondary text-center mb-4">
                            Focus only on counting <span className="text-blue-400 font-semibold">BLUE CIRCLES</span> and judging Odd/Even. Don't worry about remembering the counts yet.
                        </p>
                    )}
                    {step === 'processingPractice' && (
                        <p className="text-sm sm:text-xs text-theme-text-muted font-mono text-center mb-4">
                            Trial {trialNum + 1} of {totalTrials}
                        </p>
                    )}

                    {step === 'processingPractice' && practiceSubStep === 'judgment' && currentStimulus?.items && (
                        <>
                            <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-4">
                                <StimulusDisplay items={currentStimulus.items} />
                            </div>
                            <p className="text-base font-medium text-theme-text text-center mb-4">
                                Is the count of <span className="text-blue-400 font-semibold">BLUE CIRCLES</span> Odd or Even?
                            </p>
                            <div className="flex space-x-4 justify-center">
                                <button
                                    onClick={() => handlePracticeJudgment(true)}
                                    className="px-8 py-3 text-base font-semibold bg-theme-bg-elevated border border-theme-line text-theme-text hover:border-theme-accent hover:text-theme-accent transition-colors"
                                >
                                    Odd
                                </button>
                                <button
                                    onClick={() => handlePracticeJudgment(false)}
                                    className="px-8 py-3 text-base font-semibold bg-theme-bg-elevated border border-theme-line text-theme-text hover:border-theme-accent hover:text-theme-accent transition-colors"
                                >
                                    Even
                                </button>
                            </div>
                        </>
                    )}

                    {feedback && (
                        <div className="mt-4 text-sm text-theme-accent bg-theme-accent/10 border border-theme-accent/30 p-4 text-center">
                            {feedback}
                        </div>
                    )}

                    {step === 'processingPractice_done' && (
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 text-status-success mb-4">
                                <FontAwesomeIcon icon={faCheckCircle} className="h-5 w-5" />
                                <span className="font-mono">Practice 1 Complete</span>
                            </div>
                            <p className="text-sm text-theme-text-secondary mb-6">Next, practice recalling sequences.</p>
                            <button
                                onClick={handleNextOverallStep}
                                className="btn-primary-lab py-3 px-6 text-sm flex items-center gap-2 mx-auto"
                            >
                                <span>Continue</span>
                                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        // --- Render Recall Practice (Step 2) ---
        if (step === 'recallPractice' || step === 'recallPractice_done') {
            const totalTrials = RECALL_PRACTICE_EXAMPLE_TRIALS.length;
            return (
                <div className="p-6 sm:p-8">
                    <ProgressIndicator />
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                        <h3 className="text-sm sm:text-xs uppercase tracking-[0.2em] text-theme-text-muted font-mono">Practice 2 of 3</h3>
                    </div>
                    <h3 className="text-lg font-serif italic text-theme-text text-center mb-4">Recalling a Sequence</h3>

                    {step === 'recallPractice' && practiceSubStep === 'judgment' && (
                        <p className="text-sm text-theme-text-secondary text-center mb-4">
                            Count the <span className="text-blue-400 font-semibold">BLUE CIRCLES</span> and judge Odd/Even. Try to remember the sequence of counts.
                        </p>
                    )}
                    {step === 'recallPractice' && practiceSubStep === 'judgment' && (
                        <p className="text-sm sm:text-xs text-theme-text-muted font-mono text-center mb-4">
                            Item {trialNum + 1} of {totalTrials}
                        </p>
                    )}
                    {step === 'recallPractice' && practiceSubStep === 'recall' && (
                        <p className="text-sm text-theme-text-secondary text-center mb-4">
                            Now, recall the <span className="text-theme-text font-semibold">{RECALL_PRACTICE_SET_SIZE}</span> counts you just saw in the correct order.
                        </p>
                    )}

                    {step === 'recallPractice' && practiceSubStep === 'judgment' && currentStimulus?.items && (
                        <>
                            <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-4">
                                <StimulusDisplay items={currentStimulus.items} />
                            </div>
                            <p className="text-base font-medium text-theme-text text-center mb-4">Is the count Odd or Even?</p>
                            <div className="flex space-x-4 justify-center">
                                <button
                                    onClick={() => handlePracticeJudgment(true)}
                                    className="px-8 py-3 text-base font-semibold bg-theme-bg-elevated border border-theme-line text-theme-text hover:border-theme-accent hover:text-theme-accent transition-colors"
                                >
                                    Odd
                                </button>
                                <button
                                    onClick={() => handlePracticeJudgment(false)}
                                    className="px-8 py-3 text-base font-semibold bg-theme-bg-elevated border border-theme-line text-theme-text hover:border-theme-accent hover:text-theme-accent transition-colors"
                                >
                                    Even
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'recallPractice' && practiceSubStep === 'recall' && (
                        <div className="bg-theme-bg-elevated border border-theme-line p-4">
                            <RecallInterface
                                setSize={RECALL_PRACTICE_SET_SIZE}
                                onSubmit={handleRecallPracticeSubmit}
                                value={practiceRecallSequence}
                                onChange={handlePracticeRecallChange}
                            />
                        </div>
                    )}

                    {feedback && (
                        <div className="mt-4 text-sm text-theme-accent bg-theme-accent/10 border border-theme-accent/30 p-4 text-center">
                            {feedback}
                        </div>
                    )}

                    {step === 'recallPractice_done' && (
                        <div className="text-center mt-4">
                            <div className="flex items-center justify-center gap-2 text-status-success mb-4">
                                <FontAwesomeIcon icon={faCheckCircle} className="h-5 w-5" />
                                <span className="font-mono">Practice 2 Complete</span>
                            </div>
                            <p className="text-sm text-theme-text-secondary mb-6">Finally, let's combine everything.</p>
                            <button
                                onClick={handleNextOverallStep}
                                className="btn-primary-lab py-3 px-6 text-sm flex items-center gap-2 mx-auto"
                            >
                                <span>Continue</span>
                                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        // --- Render Integrated Practice (Step 3) ---
        if (step === 'integratedPractice' || step === 'integratedPractice_done') {
            const totalTrials = INTEGRATED_PRACTICE_EXAMPLE_SET_TRIALS.length;
            return (
                <div className="p-6 sm:p-8">
                    <ProgressIndicator />
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                        <h3 className="text-sm sm:text-xs uppercase tracking-[0.2em] text-theme-text-muted font-mono">Practice 3 of 3</h3>
                    </div>
                    <h3 className="text-lg font-serif italic text-theme-text text-center mb-4">Putting It Together</h3>

                    {step === 'integratedPractice' && (
                        <p className="text-sm text-theme-text-secondary text-center mb-4">
                            Now, count, judge Odd/Even, <span className="text-theme-text font-semibold">AND remember</span> the counts for recall.
                        </p>
                    )}
                    {step === 'integratedPractice' && (
                        <p className="text-sm sm:text-xs text-theme-text-muted font-mono text-center mb-4">
                            Practice Set 1, Trial {trialNum + 1} of {totalTrials}
                        </p>
                    )}

                    {step === 'integratedPractice' && practiceSubStep === 'judgment' && currentStimulus?.items && (
                        <>
                            <div className="bg-theme-bg-elevated border border-theme-line p-4 mb-4">
                                <StimulusDisplay items={currentStimulus.items} />
                            </div>
                            <p className="text-base font-medium text-theme-text text-center mb-4">Is the count Odd or Even?</p>
                            <div className="flex space-x-4 justify-center">
                                <button
                                    onClick={() => handlePracticeJudgment(true)}
                                    className="px-8 py-3 text-base font-semibold bg-theme-bg-elevated border border-theme-line text-theme-text hover:border-theme-accent hover:text-theme-accent transition-colors"
                                >
                                    Odd
                                </button>
                                <button
                                    onClick={() => handlePracticeJudgment(false)}
                                    className="px-8 py-3 text-base font-semibold bg-theme-bg-elevated border border-theme-line text-theme-text hover:border-theme-accent hover:text-theme-accent transition-colors"
                                >
                                    Even
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'integratedPractice' && practiceSubStep === 'recall' && (
                        <>
                            <p className="text-sm text-theme-text-secondary text-center mb-4">
                                Recall the <span className="text-theme-text font-semibold">{INTEGRATED_PRACTICE_SET_SIZE}</span> counts from this practice set in order.
                            </p>
                            <div className="bg-theme-bg-elevated border border-theme-line p-4">
                                <RecallInterface
                                    setSize={INTEGRATED_PRACTICE_SET_SIZE}
                                    onSubmit={handleIntegratedRecallSubmit}
                                    value={integratedRecallSequence}
                                    onChange={handleIntegratedRecallChange}
                                />
                            </div>
                        </>
                    )}

                    {feedback && (
                        <div className={`mt-4 text-sm p-4 text-center border ${
                            step === 'integratedPractice_done'
                                ? 'text-status-success bg-status-success/10 border-status-success/30'
                                : 'text-theme-accent bg-theme-accent/10 border-theme-accent/30'
                        }`}>
                            {feedback}
                        </div>
                    )}

                    {step === 'integratedPractice_done' && (
                        <div className="text-center mt-4">
                            <div className="flex items-center justify-center gap-2 text-status-success mb-4">
                                <FontAwesomeIcon icon={faCheckCircle} className="h-5 w-5" />
                                <span className="font-mono">All Practice Complete!</span>
                            </div>
                            <p className="text-sm text-theme-text-secondary mb-6">You're ready to exit the tutorial.</p>
                            <button
                                onClick={handleNextOverallStep}
                                className="bg-status-success text-white py-3 px-6 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 mx-auto hover:bg-status-success/90 transition-colors"
                            >
                                <span>Exit Tutorial</span>
                                <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="p-6 text-center">
                <p className="text-theme-text-muted font-mono">Loading Instructions...</p>
            </div>
        );
    };

    return (
        <div className="text-center">
            {renderContent()}
        </div>
    );
};

CountingSpanInstructions.propTypes = {
    onStartAssessment: PropTypes.func.isRequired,
};

export default CountingSpanInstructions;
