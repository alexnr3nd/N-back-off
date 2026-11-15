/* src/components/testing/countingSpan/StimulusDisplay.js */
/* Redesigned with Cognitive Lab aesthetic */
import React from 'react';
import PropTypes from 'prop-types';

// Define colors optimized for dark theme display
const COLORS = {
    blue: '#3b82f6', // Solid blue
    green: '#059669', // Muted emerald green (less vibrant)
    blueDark: '#1d4ed8', // Darker blue for stroke
    greenDark: '#047857', // Darker green for stroke
};
// Define stroke properties for crisp edges
const STROKE_WIDTH = 1.5;

/**
 * Renders a single shape (circle or square) within the SVG canvas.
 * Includes validation for coordinates and an optional stroke for visual distinction.
 *
 * @param {object} props
 * @param {string} props.id - Unique identifier for the shape (used for logging and React key).
 * @param {'blueCircle'|'greenCircle'|'blueSquare'} props.type - The type of shape to render.
 * @param {number} props.x - The x-coordinate for the shape's center (or top-left for rect).
 * @param {number} props.y - The y-coordinate for the shape's center (or top-left for rect).
 * @param {number} [props.size=30] - The diameter/width/height of the shape.
 * @returns {React.ReactElement|null} The SVG element for the shape or null if coordinates are invalid.
 */
const Shape = ({ id, type, x, y, size = 30 }) => {

    // --- Coordinate Validation ---
    // Check if x or y are not valid numbers (including NaN).
    if (typeof x !== 'number' || isNaN(x) || typeof y !== 'number' || isNaN(y)) {
        // Log an error to the console to help debug the source of the invalid coordinate.
        console.error(`[Shape Component] Invalid coordinate received for item id "${id}" (type: ${type}). x: ${x}, y: ${y}. Skipping render for this shape.`);
        // Return null to prevent attempting to render this specific shape, thus avoiding the SVG error.
        return null;
    }
    // --- End Validation ---


    // --- Common SVG Properties ---
    const radius = size / 2;

    // --- Render SVG Element Based on Type ---
    switch (type) {
        case 'blueCircle':
            return (
                <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={COLORS.blue}
                    stroke={COLORS.blueDark}
                    strokeWidth={STROKE_WIDTH}
                />
            );
        case 'greenCircle':
            return (
                <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={COLORS.green}
                    stroke={COLORS.greenDark}
                    strokeWidth={STROKE_WIDTH}
                />
            );
        case 'blueSquare':
            return (
                <rect
                    x={x - size / 2}
                    y={y - size / 2}
                    width={size}
                    height={size}
                    fill={COLORS.blue}
                    stroke={COLORS.blueDark}
                    strokeWidth={STROKE_WIDTH}
                />
            );
        default:
            // Log a warning if the type is unknown, but still return null to prevent errors.
            console.warn(`[Shape Component] Unknown shape type received: ${type} for id: ${id}`);
            return null;
    }
};

// PropTypes validation for the Shape component
Shape.propTypes = {
    id: PropTypes.string.isRequired, // ID is required for key and logging
    type: PropTypes.oneOf(['blueCircle', 'greenCircle', 'blueSquare']).isRequired,
    // Coordinates are technically required but checked internally, so not marked isRequired here
    x: PropTypes.number,
    y: PropTypes.number,
    size: PropTypes.number, // Optional size override
};


/**
 * Renders the main visual stimulus display area containing multiple shapes.
 * It receives an array of item objects, each describing a shape's properties.
 *
 * @param {object} props
 * @param {Array<object>} [props.items=[]] - An array of item objects, where each object has `id`, `type`, `x`, `y`, and optionally `size`.
 * @returns {React.ReactElement} The SVG container with rendered shapes or an error message.
 */
const StimulusDisplay = ({ items }) => { // Default prop handles undefined case
    // Define the coordinate system size for the SVG canvas.
    // These should match or be proportional to DISPLAY_WIDTH/HEIGHT in countingSpanUtils.js
    // for consistent positioning logic.
    const viewBoxWidth = 500;
    const viewBoxHeight = 350;

    // --- Input Validation ---
    // Defensive check: Ensure items prop is actually an array before trying to map over it.
    if (!Array.isArray(items)) {
        console.error("[StimulusDisplay] Received invalid 'items' prop (expected array, got):", items);
        // Render a user-friendly error message within the component's space
        return (
            <div className="w-full h-[350px] flex items-center justify-center text-status-error border border-status-error bg-status-error/10 p-4 text-center font-mono text-sm">
                Error: Could not display stimulus due to invalid data.
            </div>
        );
    }
    // --- End Input Validation ---

    return (
        // Container div for layout and accessibility attributes
        <div
            className="w-full flex items-center justify-center my-4"
            // Hide the purely decorative SVG content from screen readers
            aria-hidden="true"
        >
            {/* SVG Canvas */}
            <svg
                // Defines the internal coordinate system (0,0 top-left to 500,350 bottom-right)
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                // Controls how the SVG scales if its container size differs from the viewBox aspect ratio
                preserveAspectRatio="xMidYMid meet"
                // Explicit dimensions for Safari/WebKit compatibility (CSS still constrains via max-w/max-h)
                width={viewBoxWidth}
                height={viewBoxHeight}
                // Dark theme styling for the SVG container
                className="max-w-full max-h-[350px] border border-theme-line bg-theme-bg-secondary"
            >
                {/* Map through the validated items array and render a Shape component for each item */}
                {items.map((item) => (
                    // Add another layer of checking: ensure item is an object and has an id
                    // before attempting to render the Shape component.
                    item && typeof item === 'object' && item.id ? (
                        <Shape
                            // Use the unique item ID as the React key for efficient updates
                            key={item.id}
                            // Pass all necessary props down to the Shape component
                            id={item.id} // Pass id for logging within Shape
                            type={item.type}
                            x={item.x} // Pass coordinate (may be invalid, Shape handles it)
                            y={item.y} // Pass coordinate (may be invalid, Shape handles it)
                            size={item.size} // Pass optional size if defined
                        />
                    ) : (
                         // If an item in the array is malformed (null, undefined, or missing id),
                         // log a warning and render nothing for that specific item.
                         console.warn("[StimulusDisplay] Invalid item found in items array (skipped rendering):", item),
                         null // Render nothing for this invalid item entry
                    )
                ))}
            </svg>
        </div>
    );
};

// PropTypes validation for the StimulusDisplay component
StimulusDisplay.propTypes = {
    // Expects an array of objects. Use `arrayOf` and `shape` for detailed validation.
    items: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired, // Each item must have a unique string id
            type: PropTypes.string.isRequired, // Each item must have a type string
            // Coordinates are validated within Shape, so not marked isRequired here
            x: PropTypes.number,
            y: PropTypes.number,
            size: PropTypes.number, // Optional size per item
        })
    ), // The items prop itself is optional, will use defaultProps if not provided
};

// Set default props to ensure `items` is always an array, even if the prop isn't passed.
StimulusDisplay.defaultProps = {
    items: [],
};


export default StimulusDisplay;
