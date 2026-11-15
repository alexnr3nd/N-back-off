// src/components/experimental/positionNBackExact/PositionNBackExactControls.js
import React from 'react';

const PositionNBackExactControls = ({ settings, onSettingsChange, onStartGame, disabled }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Ensure value is not empty before parsing, or handle appropriately
    const parsedValue = value === '' ? '' : parseInt(value, 10);
    onSettingsChange({ [name]: parsedValue });
  };

  const handleBlur = (e) => {
    const { name, value, min, max } = e.target;
    let numericValue = parseInt(value, 10);
    if (isNaN(numericValue) || value === '') {
      // Handle empty or non-numeric input, e.g., reset to default or show error
      // For now, let's revert to a sensible default if invalid, e.g. min
      numericValue = parseInt(min, 10) || 0;
    } else {
        if (min && numericValue < parseInt(min, 10)) numericValue = parseInt(min, 10);
        if (max && numericValue > parseInt(max, 10)) numericValue = parseInt(max, 10);
    }
    onSettingsChange({ [name]: numericValue });
  };


  return (
    <div className="mb-6 p-4 border rounded-md shadow bg-white">
      <h2 className="text-lg font-semibold mb-3">Game Settings</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nLevel" className="block text-sm font-medium text-gray-700">N-Level:</label>
          <input
            type="number"
            name="nLevel"
            id="nLevel"
            value={settings.nLevel}
            onChange={handleChange}
            onBlur={handleBlur}
            min="1"
            max="5" 
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={disabled}
          />
        </div>
        <div>
          <label htmlFor="numTrials" className="block text-sm font-medium text-gray-700">Number of Trials:</label>
          <input
            type="number"
            name="numTrials"
            id="numTrials"
            value={settings.numTrials}
            onChange={handleChange}
            onBlur={handleBlur}
            min="10"
            max="100"
            step="1"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={disabled}
          />
        </div>
        <div>
          <label htmlFor="isiMs" className="block text-sm font-medium text-gray-700">Trial Duration (ms):</label>
          <input
            type="number"
            name="isiMs"
            id="isiMs"
            value={settings.isiMs}
            onChange={handleChange}
            onBlur={handleBlur}
            min="500"
            max="5000"
            step="100"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={disabled}
          />
        </div>
        <div>
          <label htmlFor="stimulusDurationMs" className="block text-sm font-medium text-gray-700">Stimulus Duration (ms):</label>
          <input
            type="number"
            name="stimulusDurationMs"
            id="stimulusDurationMs"
            value={settings.stimulusDurationMs}
            onChange={handleChange}
            onBlur={handleBlur}
            min="100"
            max={settings.isiMs - 100 > 100 ? settings.isiMs - 100 : 100} // Ensure stim duration < ISI
            step="50"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={disabled}
          />
        </div>
      </div>
      <button
        onClick={onStartGame}
        disabled={disabled}
        className="mt-6 w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Start Game
      </button>
    </div>
  );
};

export default PositionNBackExactControls;