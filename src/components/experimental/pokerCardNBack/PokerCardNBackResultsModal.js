// src/components/experimental/pokerCardNBack/PokerCardNBackResultsModal.js
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faTimes, faChartLine, faCog } from '@fortawesome/free-solid-svg-icons';

// Re-define StatisticCard here or import if made common, for simplicity defining it here.
const StatisticCard = ({ label, value, icon, color = "blue" }) => {
    // Construct class strings directly to help Tailwind's JIT compiler
    const bgColorClass = color === 'blue' ? 'bg-blue-50' : 'bg-green-50';
    const borderColorClass = color === 'blue' ? 'border-blue-100' : 'border-green-100';
    const textColorClass = color === 'blue' ? 'text-blue-500' : 'text-green-500';
    const valueColorClass = color === 'blue' ? 'text-blue-700' : 'text-green-700';

    return (
    <div className={`${bgColorClass} rounded-lg p-3 border ${borderColorClass}`}>
        <div className="flex items-center mb-1">
            <FontAwesomeIcon icon={icon} className={`${textColorClass} mr-2 h-4 w-4`} />
            <span className="text-xs font-medium text-gray-700">{label}</span>
        </div>
        <div className={`text-lg font-semibold ${valueColorClass}`}>{value}</div>
    </div>
)};

const PokerCardNBackResultsModal = ({ isOpen, onClose, results, onPlayAgain }) => {
    if (!isOpen || !results) return null;

    const { score, nBack, durationMinutes, isiOption, matchFrequencyOption } = results;

    const formatResults = (type) => {
        const s = score[type];
        if (!s || (s.hits + s.misses + s.falseAlarms + s.correctRejections) === 0) return '0.0%';
        const accuracy = (s.hits + s.correctRejections) / (s.hits + s.misses + s.falseAlarms + s.correctRejections);
        return `${(accuracy * 100).toFixed(1)}%`;
    };

    const formatDetailedResults = (type) => {
        const s = score[type];
        if (!s) return 'Hits: 0 | Misses: 0 | False Alarms: 0';
        return `Hits: ${s.hits} | Misses: ${s.misses} | False Alarms: ${s.falseAlarms}`;
    };

    const handlePlayAgainClick = () => {
        onPlayAgain();
        onClose(); // Modal should close when play again is clicked
    };

    return (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">​</span> {/* Centering trick */}
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full animate-fadeInScaleUp">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                                <FontAwesomeIcon icon={faChartLine} className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    Game Results
                                </h3>
                                <div className="mt-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <StatisticCard
                                            label="Suit Accuracy"
                                            value={formatResults('suit')}
                                            icon={faChartLine}
                                            color="blue"
                                        />
                                        <StatisticCard
                                            label="Rank Accuracy"
                                            value={formatResults('rank')}
                                            icon={faChartLine}
                                            color="green"
                                        />
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                        <h4 className="text-sm font-medium text-gray-700 mb-1">Suit Performance</h4>
                                        <p className="text-xs text-gray-600">{formatDetailedResults('suit')}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Possible Matches: {score.totalPossibleSuitMatches}</p>
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                        <h4 className="text-sm font-medium text-gray-700 mb-1">Rank Performance</h4>
                                        <p className="text-xs text-gray-600">{formatDetailedResults('rank')}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Possible Matches: {score.totalPossibleRankMatches}</p>
                                    </div>

                                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                        <div className="flex items-center mb-2">
                                            <FontAwesomeIcon icon={faCog} className="h-4 w-4 text-indigo-600 mr-2" />
                                            <h4 className="text-sm font-medium text-indigo-700">Game Settings</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-indigo-600">
                                            <div><span className="font-medium">N-Back:</span> {nBack}</div>
                                            <div><span className="font-medium">Duration:</span> {durationMinutes} min</div>
                                            <div><span className="font-medium">Card Speed:</span> {isiOption.label}</div>
                                            <div><span className="font-medium">Match Freq:</span> {matchFrequencyOption.label}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={handlePlayAgainClick}
                        >
                            <FontAwesomeIcon icon={faPlay} className="mr-2 h-4 w-4" />
                            Play Again
                        </button>
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                             <FontAwesomeIcon icon={faTimes} className="mr-2 h-4 w-4" />
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PokerCardNBackResultsModal;