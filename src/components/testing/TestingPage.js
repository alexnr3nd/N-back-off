/* src/components/testing/TestingPage.js */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faMicroscope, faClock } from '@fortawesome/free-solid-svg-icons';
import { useUser } from '../../contexts/UserContext';
import { canAccessProAssessments } from '../../utils/assessmentAccess';

// --- Inline SVG Illustrations ---

const CountingSpanIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* Blue circles (targets) */}
        <circle cx="80" cy="55" r="18" fill="#3b82f6" opacity="0.9" />
        <circle cx="200" cy="40" r="14" fill="#3b82f6" opacity="0.8" />
        <circle cx="145" cy="105" r="16" fill="#3b82f6" opacity="0.85" />
        <circle cx="260" cy="90" r="12" fill="#3b82f6" opacity="0.75" />
        {/* Green circles (distractors) */}
        <circle cx="50" cy="115" r="13" fill="#059669" opacity="0.6" />
        <circle cx="240" cy="130" r="11" fill="#059669" opacity="0.5" />
        {/* Blue squares (distractors) */}
        <rect x="155" y="30" width="22" height="22" fill="#3b82f6" opacity="0.6" />
        <rect x="95" y="100" width="18" height="18" fill="#3b82f6" opacity="0.5" />
        <rect x="275" y="45" width="16" height="16" fill="#3b82f6" opacity="0.55" />
    </svg>
);

const OperationSpanIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* Math equation */}
        <text x="160" y="65" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="28" fill="#9ca3af" opacity="0.9">
            (3 × 4) + 2 = ?
        </text>
        {/* Divider line */}
        <line x1="100" y1="85" x2="220" y2="85" stroke="#c9a048" strokeWidth="1" opacity="0.3" />
        {/* Letter to remember */}
        <text x="160" y="130" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="36" fontWeight="bold" fill="#c9a048" opacity="0.85">
            F
        </text>
    </svg>
);

const DigitSpanIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* Earlier digits fading as the sequence advances */}
        <text x="70" y="78" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="30" fill="#9ca3af" opacity="0.3">4</text>
        <text x="125" y="78" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="30" fill="#9ca3af" opacity="0.5">9</text>
        <text x="180" y="78" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="30" fill="#9ca3af" opacity="0.7">2</text>
        {/* Current digit */}
        <text x="245" y="84" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="44" fontWeight="bold" fill="#c9a048" opacity="0.85">7</text>
        {/* Reverse-recall arrow */}
        <line x1="232" y1="112" x2="86" y2="112" stroke="#c9a048" strokeWidth="1.5" opacity="0.4" />
        <polygon points="86,112 96,107 96,117" fill="#c9a048" opacity="0.4" />
    </svg>
);

const SymmetrySpanIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* Symmetry pattern: 6x6 mini-matrix, left half mirrored onto the right */}
        <rect x="55" y="25" width="110" height="110" fill="none" stroke="#9ca3af" strokeWidth="1" opacity="0.35" />
        {/* Left-half cells */}
        <rect x="58" y="28" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        <rect x="76" y="64" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        <rect x="94" y="46" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        <rect x="58" y="100" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        <rect x="94" y="118" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        {/* Mirrored right-half cells */}
        <rect x="146" y="28" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        <rect x="128" y="64" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        <rect x="110" y="46" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        <rect x="146" y="100" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        <rect x="110" y="118" width="16" height="16" fill="#9ca3af" opacity="0.65" />
        {/* Vertical mirror axis */}
        <line x1="110" y1="18" x2="110" y2="142" stroke="#c9a048" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
        {/* 4x4 recall grid with one red square */}
        <rect x="200" y="40" width="80" height="80" fill="none" stroke="#9ca3af" strokeWidth="1" opacity="0.35" />
        <line x1="220" y1="40" x2="220" y2="120" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        <line x1="240" y1="40" x2="240" y2="120" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        <line x1="260" y1="40" x2="260" y2="120" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        <line x1="200" y1="60" x2="280" y2="60" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        <line x1="200" y1="80" x2="280" y2="80" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        <line x1="200" y1="100" x2="280" y2="100" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        <rect x="242" y="62" width="16" height="16" fill="#dc2626" opacity="0.85" />
    </svg>
);

const VisualArraysIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* Mid-gray stimulus field */}
        <rect x="55" y="15" width="210" height="130" rx="6" fill="#9ca3af" opacity="0.18" />
        {/* Cue word */}
        <text x="160" y="42" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="16" fontWeight="bold" fill="#dc2626" opacity="0.8">RED</text>
        {/* Red target rectangles (rotated) — one carries the white probe dot */}
        <rect x="90" y="70" width="34" height="12" fill="#dc2626" opacity="0.85" transform="rotate(45 107 76)" />
        <rect x="195" y="60" width="34" height="12" fill="#dc2626" opacity="0.85" transform="rotate(90 212 66)" />
        <rect x="140" y="105" width="34" height="12" fill="#dc2626" opacity="0.85" transform="rotate(135 157 111)" />
        <circle cx="107" cy="76" r="4" fill="#ffffff" opacity="0.95" />
        {/* Blue distractor rectangles */}
        <rect x="230" y="100" width="34" height="12" fill="#3b82f6" opacity="0.55" transform="rotate(45 247 106)" />
        <rect x="85" y="118" width="34" height="12" fill="#3b82f6" opacity="0.55" />
    </svg>
);

const AntisaccadeIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* Central fixation cross */}
        <text x="160" y="95" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="28" fill="#9ca3af" opacity="0.55">+</text>
        {/* Cue flash — the reflexive pull to resist */}
        <text x="70" y="108" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="42" fontWeight="bold" fill="#9ca3af" opacity="0.8">*</text>
        {/* Target letter on the side opposite the flash — Rubik, like the
            real stimulus (its Q reads as O until you actually look at it) */}
        <text x="250" y="98" textAnchor="middle" fontFamily="'Rubik', sans-serif" fontSize="26" fontWeight="400" fill="#c9a048" opacity="0.85">Q</text>
        {/* Gaze cue: away from the flash, toward the letter */}
        <line x1="96" y1="132" x2="234" y2="132" stroke="#c9a048" strokeWidth="1.5" opacity="0.4" />
        <polygon points="234,132 224,127 224,137" fill="#c9a048" opacity="0.4" />
    </svg>
);

const RelationMonitoringIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* 3x3 grid of three-digit numbers; the middle row ends 4-4-4 */}
        <rect x="82" y="22" width="156" height="120" fill="none" stroke="#9ca3af" strokeWidth="1" opacity="0.35" />
        <line x1="134" y1="22" x2="134" y2="142" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        <line x1="186" y1="22" x2="186" y2="142" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        <line x1="82" y1="62" x2="238" y2="62" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        <line x1="82" y1="102" x2="238" y2="102" stroke="#9ca3af" strokeWidth="0.75" opacity="0.3" />
        {/* Top row — no relation */}
        <text x="108" y="49" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="17" fill="#9ca3af" opacity="0.6">254</text>
        <text x="160" y="49" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="17" fill="#9ca3af" opacity="0.6">871</text>
        <text x="212" y="49" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="17" fill="#9ca3af" opacity="0.6">463</text>
        {/* Middle row — the matching line */}
        <text x="108" y="89" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="17" fontWeight="bold" fill="#c9a048" opacity="0.9">134</text>
        <text x="160" y="89" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="17" fontWeight="bold" fill="#c9a048" opacity="0.9">524</text>
        <text x="212" y="89" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="17" fontWeight="bold" fill="#c9a048" opacity="0.9">904</text>
        {/* Bottom row — no relation */}
        <text x="108" y="129" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="17" fill="#9ca3af" opacity="0.6">342</text>
        <text x="160" y="129" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="17" fill="#9ca3af" opacity="0.6">785</text>
        <text x="212" y="129" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="17" fill="#9ca3af" opacity="0.6">618</text>
    </svg>
);

const LetterNumberComparisonIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* Two stacked strings with a dividing rule — a comparison pair */}
        <text x="148" y="64" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="30" letterSpacing="6" fill="#9ca3af" opacity="0.7">BQK</text>
        <line x1="104" y1="82" x2="192" y2="82" stroke="#9ca3af" strokeWidth="1.25" opacity="0.4" />
        <text x="148" y="114" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="30" letterSpacing="6" fill="#9ca3af" opacity="0.7">BQ<tspan fill="#c9a048" fontWeight="bold">X</tspan></text>
        {/* Stopwatch accent (top-right) */}
        <circle cx="248" cy="46" r="15" fill="none" stroke="#c9a048" strokeWidth="2" opacity="0.85" />
        <line x1="248" y1="33" x2="248" y2="28" stroke="#c9a048" strokeWidth="2" opacity="0.85" />
        <line x1="248" y1="46" x2="248" y2="38" stroke="#c9a048" strokeWidth="2" opacity="0.85" />
        <line x1="248" y1="46" x2="255" y2="50" stroke="#c9a048" strokeWidth="2" opacity="0.85" />
    </svg>
);

const ReasoningCheckIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* 2x2 matrix-reasoning grid */}
        <rect x="90" y="15" width="140" height="130" fill="none" stroke="#9ca3af" strokeWidth="1" opacity="0.35" />
        <line x1="160" y1="15" x2="160" y2="145" stroke="#9ca3af" strokeWidth="1" opacity="0.35" />
        <line x1="90" y1="80" x2="230" y2="80" stroke="#9ca3af" strokeWidth="1" opacity="0.35" />
        {/* Top-left: one circle */}
        <circle cx="125" cy="47" r="10" fill="#9ca3af" opacity="0.6" />
        {/* Top-right: two circles */}
        <circle cx="183" cy="47" r="10" fill="#9ca3af" opacity="0.6" />
        <circle cx="208" cy="47" r="10" fill="#9ca3af" opacity="0.6" />
        {/* Bottom-left: one square */}
        <rect x="115" y="102" width="20" height="20" fill="#9ca3af" opacity="0.6" />
        {/* Bottom-right: the missing cell */}
        <text x="195" y="124" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="34" fontWeight="bold" fill="#c9a048" opacity="0.85">?</text>
    </svg>
);

const FaceNameMemoryIllustration = () => (
    <svg viewBox="0 0 320 160" className="w-full h-full" aria-hidden="true">
        {/* Framed portrait — a "specimen" photo of a person */}
        <rect x="40" y="30" width="100" height="104" rx="6" fill="#9ca3af" opacity="0.12" />
        <rect x="40" y="30" width="100" height="104" rx="6" fill="none" stroke="#9ca3af" strokeWidth="1.25" opacity="0.4" />
        <circle cx="90" cy="68" r="22" fill="none" stroke="#9ca3af" strokeWidth="1.75" opacity="0.7" />
        <path d="M58 132 C 58 102, 122 102, 122 132" fill="none" stroke="#9ca3af" strokeWidth="1.75" opacity="0.7" />
        {/* The name, spoken — sound waves carrying it toward the name plate */}
        <path d="M152 72 Q 161 80 152 88" fill="none" stroke="#c9a048" strokeWidth="1.75" strokeLinecap="round" opacity="0.85" />
        <path d="M160 64 Q 176 80 160 96" fill="none" stroke="#c9a048" strokeWidth="1.75" strokeLinecap="round" opacity="0.55" />
        <path d="M168 56 Q 190 80 168 104" fill="none" stroke="#c9a048" strokeWidth="1.75" strokeLinecap="round" opacity="0.32" />
        {/* Name plate */}
        <rect x="198" y="58" width="92" height="44" rx="4" fill="#c9a048" opacity="0.06" />
        <rect x="198" y="58" width="92" height="44" rx="4" fill="none" stroke="#c9a048" strokeWidth="1.75" opacity="0.85" />
        <text x="244" y="86" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="20" letterSpacing="2" fill="#c9a048" opacity="0.9">MAYA</text>
    </svg>
);

// --- Assessment Card Data ---

const ASSESSMENTS = [
    // Free assessments first
    {
        id: 'operation-span',
        title: 'Operation Span',
        description: 'Solve math equations while remembering letters presented between each problem.',
        duration: '~20 min',
        path: '/testing/operation-span',
        illustration: OperationSpanIllustration,
        active: true,
    },
    {
        id: 'reasoning',
        title: 'Reasoning Check',
        description: 'Solve verbal, number-series, matrix, and rotation puzzles — an annual fluid-reasoning baseline.',
        duration: '10–15 min',
        path: '/testing/reasoning',
        illustration: ReasoningCheckIllustration,
        active: true,
    },
    {
        id: 'counting-span',
        title: 'Counting Span',
        description: 'Count blue circles among distractors while remembering the sequence of counts.',
        duration: '10–15 min',
        path: '/testing/counting-span',
        illustration: CountingSpanIllustration,
        active: true,
        pro: true,
    },
    {
        id: 'digit-span',
        title: 'Digit Span',
        description: 'Recall growing sequences of digits in order, then again in reverse order.',
        duration: '10–15 min',
        path: '/testing/digit-span',
        illustration: DigitSpanIllustration,
        active: true,
        pro: true,
    },
    {
        id: 'symmetry-span',
        title: 'Symmetry Span',
        description: 'Judge whether patterns are symmetric while remembering the sequence of red square locations.',
        duration: '10–15 min',
        path: '/testing/symmetry-span',
        illustration: SymmetrySpanIllustration,
        active: true,
        pro: true,
    },
    {
        id: 'visual-arrays',
        title: 'Visual Arrays',
        description: 'Remember the tilt of the cued color\'s rectangles and spot the change — while ignoring the rest.',
        duration: '10–12 min',
        path: '/testing/visual-arrays',
        illustration: VisualArraysIllustration,
        active: true,
        pro: true,
    },
    {
        id: 'antisaccade',
        title: 'Antisaccade',
        description: 'Resist the reflexive glance toward the flash and catch the masked letter on the opposite side — a test of attention control.',
        duration: '~10 min',
        path: '/testing/antisaccade',
        illustration: AntisaccadeIllustration,
        active: true,
        pro: true,
    },
    {
        id: 'relation-monitoring',
        title: 'Relation Monitoring',
        description: 'Spot the rows and columns whose numbers end in the same digit before the grid changes — a test of relational integration.',
        duration: '~12 min',
        path: '/testing/relation-monitoring',
        illustration: RelationMonitoringIllustration,
        active: true,
        pro: true,
    },
    {
        id: 'letter-number-comparison',
        title: 'Letter & Number Comparison Speed',
        description: 'Decide whether two letter or number strings match — as many as you can in each 30-second block. A classic test of perceptual speed.',
        duration: '~5 min',
        path: '/testing/letter-number-comparison',
        illustration: LetterNumberComparisonIllustration,
        active: true,
        pro: true,
    },
    {
        id: 'face-name-memory',
        title: 'Face-Name Memory',
        description: 'Study a set of faces with their names, then recall each name from memory after a short delay — a test of associative memory.',
        duration: '~7 min',
        path: '/testing/face-name-memory',
        illustration: FaceNameMemoryIllustration,
        active: true,
        pro: true,
    },
];

// --- Assessment Card Component ---

const AssessmentCard = ({ assessment, showTierBadges }) => {
    const { title, description, duration, path, illustration: Illustration, active, pro } = assessment;

    const cardContent = (
        <div className={`specimen-card flex flex-col h-full transition-colors duration-200 ${
            active ? 'group hover:border-theme-accent cursor-pointer' : 'opacity-50'
        }`}>
            {/* Illustration area */}
            <div className={`h-40 flex items-center justify-center border-b border-theme-line overflow-hidden ${
                active ? 'bg-theme-bg-secondary' : 'bg-theme-bg-secondary/50'
            }`}>
                <Illustration />
            </div>

            {/* Content */}
            <div className="p-5 flex-grow flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-base font-serif italic ${active ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                        {title}
                    </h3>
                    {pro && showTierBadges && (
                        <span className="text-[0.625rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-theme-accent/20 text-theme-accent">
                            PRO
                        </span>
                    )}
                    {!pro && active && showTierBadges && (
                        <span className="text-[0.625rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">
                            FREE
                        </span>
                    )}
                    {!active && (
                        <span className="text-[0.625rem] font-mono uppercase tracking-wider text-theme-text-muted/60 px-2 py-0.5 bg-theme-bg-elevated border border-theme-line">
                            Coming Soon
                        </span>
                    )}
                </div>
                <p className={`text-sm mb-4 flex-grow ${active ? 'text-theme-text-secondary' : 'text-theme-text-muted/60'}`}>
                    {description}
                </p>
                <div className="flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faClock} className={`h-3 w-3 ${active ? 'text-theme-text-muted' : 'text-theme-text-muted/40'}`} />
                    <span className={`text-xs font-mono ${active ? 'text-theme-text-muted' : 'text-theme-text-muted/40'}`}>{duration}</span>
                </div>
            </div>

            {/* Footer */}
            {active && (
                <div className="px-5 py-3 border-t border-theme-line bg-theme-bg-elevated/30">
                    <span className="text-xs font-mono uppercase tracking-wider text-theme-accent group-hover:text-theme-text transition-colors flex items-center gap-2">
                        View Assessment
                        <FontAwesomeIcon icon={faArrowRight} className="h-2.5 w-2.5 transition-transform group-hover:translate-x-1" />
                    </span>
                </div>
            )}
        </div>
    );

    if (active && path) {
        return <Link to={path} className="block h-full no-underline">{cardContent}</Link>;
    }
    return cardContent;
};

// --- Main Page ---

const TestingPage = () => {
    const { userData, subscriptionTier } = useUser();

    // PRO/FREE tier badges are an upsell cue: hidden for users who already
    // have access to everything (Pro + grandfathered)
    const canAccessAssessments = useMemo(
        () => canAccessProAssessments(userData, subscriptionTier),
        [subscriptionTier, userData?.assessmentGrandfathered, userData?.cstHistory]
    );

    return (
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid min-h-screen">
            {/* Header */}
            <header className="mb-8 sm:mb-10">
                <div className="mb-6">
                    <Link
                        to="/dashboard"
                        className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                        <span className="text-sm sm:text-xs font-mono uppercase tracking-wider">Return to Dashboard</span>
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 relative flex-shrink-0">
                        <div className="absolute inset-0 bg-theme-accent/20 rounded-sm rotate-3"></div>
                        <div className="absolute inset-0 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent">
                            <FontAwesomeIcon icon={faMicroscope} className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Cognitive Laboratory</p>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl text-theme-text font-serif italic">
                            Cognitive Assessments
                        </h1>
                    </div>
                </div>
            </header>

            {/* Assessment Cards Grid */}
            <section>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {ASSESSMENTS.map(assessment => (
                        <AssessmentCard key={assessment.id} assessment={assessment} showTierBadges={!canAccessAssessments} />
                    ))}
                </div>
            </section>
        </div>
    );
};

export default TestingPage;
