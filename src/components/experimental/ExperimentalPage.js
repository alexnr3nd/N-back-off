// src/components/experimental/ExperimentalPage.js
// Keeping the filename but updating the internal content

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFlask, 
    faMusic, 
    faChevronRight, 
    faThLarge, 
    faMousePointer, 
    faInfoCircle,
    faBrain,
    faArrowRight,
    faLightbulb
} from '@fortawesome/free-solid-svg-icons';

const ExperimentalPage = () => {
    const navigate = useNavigate();

    const games = [
        {
            id: 'audio-n-back',
            title: 'Audio N-Back Game',
            description: 'Practice N-Back using only auditory stimuli. Configure N-level, speed, ISI, and more.',
            icon: faMusic,
            path: '/experimental/audio-n-back',
            tags: ['Audio', 'N-Back', 'Customizable'],
            color: 'blue'
        },
        {
            id: 'poker-card-n-back',
            title: 'Poker Card N-Back Game',
            description: 'Dual N-Back with poker card suits and ranks as stimuli. Configure N-level, ISI, and match frequency.',
            icon: faThLarge, 
            path: '/experimental/poker-card-n-back',
            tags: ['Visual', 'Dual Stimulus', 'N-Back', 'Cards'],
            color: 'green'
        },
        {
            id: 'position-n-back-exact',
            title: 'Position N-Back (Exact Location)',
            description: 'Test your spatial memory by clicking the exact N-back location of the stimulus. Position only. Configure N-level, speed, and trials.',
            icon: faMousePointer, 
            path: '/experimental/position-n-back-exact',
            tags: ['Visual', 'Spatial Memory', 'N-Back', 'Precision'],
            color: 'indigo'
        }
    ];

    const handleCardClick = (path) => {
        navigate(path);
    };

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 sm:mb-0 flex items-center">
                    <FontAwesomeIcon icon={faFlask} className="mr-3 h-6 w-6 text-indigo-600" />
                    Advanced Training Games
                </h1>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 self-center"
                >
                    ← Back to Dashboard
                </button>
            </div>

            {/* Introduction Card */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-8">
                <div className="sm:flex items-start">
                    <div className="hidden sm:flex h-12 w-12 bg-indigo-100 rounded-lg flex-shrink-0 mr-4 items-center justify-center">
                        <FontAwesomeIcon icon={faBrain} className="text-indigo-600 h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 mb-2">Specialized N-Back Training Modes</h2>
                        <p className="text-gray-600 mb-3">
                            These training games offer unique approaches to cognitive training with specific stimulus types and response modes.
                            Try them out to target different aspects of your working memory and cognitive control.
                        </p>
                        <div className="bg-indigo-50 border-l-4 border-indigo-400 p-3 text-sm text-indigo-800 rounded-r-md">
                            <strong>Note:</strong> These specialized training modes are actively under development.
                            Your feedback helps us improve and refine the training experience.
                        </div>
                    </div>
                </div>
            </div>

            {/* Available Games Section */}
            <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
                <FontAwesomeIcon icon={faFlask} className="mr-2 h-5 w-5 text-gray-600" />
                Available Games
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {games.map((game) => (
                    <div 
                        key={game.id}
                        className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-150 flex flex-col h-full"
                    >
                        <div className="p-5 flex-grow">
                            <div className="flex items-center mb-3">
                                <div className={`h-10 w-10 bg-${game.color}-100 rounded-full flex items-center justify-center mr-3`}>
                                    <FontAwesomeIcon icon={game.icon} className={`text-${game.color}-600 h-5 w-5`} />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800">{game.title}</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                {game.description}
                            </p>
                            {game.tags && game.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-4">
                                    {game.tags.map(tag => (
                                        <span key={tag} className="inline-block bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 bg-gray-50">
                            <button
                                onClick={() => handleCardClick(game.path)}
                                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                aria-label={`Start ${game.title}`}
                            >
                                Start Game <FontAwesomeIcon icon={faArrowRight} className="ml-2 h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Information Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">About These Training Games</h3>
                <p className="text-sm text-gray-600 mb-4">
                    These specialized N-Back variants are designed to target different aspects of working memory and cognitive control.
                    Each game uses different stimuli and interaction methods to provide varied training approaches.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <FontAwesomeIcon icon={faLightbulb} className="text-blue-600 h-4 w-4" />
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Why try different games?</h4>
                            <p className="text-xs text-gray-600">
                                Different training approaches may target specific cognitive processes. Varying your training routine
                                can help prevent adaptation and potentially lead to more comprehensive cognitive benefits.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <FontAwesomeIcon icon={faInfoCircle} className="text-blue-600 h-4 w-4" />
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Your Feedback Matters</h4>
                            <p className="text-xs text-gray-600">
                                These games are actively being developed and refined. Your experience helps us improve.
                                Feel free to use the feedback button after trying a game to share your thoughts or
                                suggest improvements.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExperimentalPage;