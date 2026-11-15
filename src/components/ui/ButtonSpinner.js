/* src/components/ui/ButtonSpinner.js */
/* Echo Mark style spinner for inline button use */
/* Dual N-Back themed: alternating pulse animation like game stimuli */

import React from 'react';

/**
 * A small echo mark-style loading spinner designed to fit inline within buttons.
 * Uses alternating pulse animation on two overlapping squares - mimicking
 * the dual n-back game's visual stimuli pattern.
 *
 * @param {string} color - 'accent' (default for dark buttons) or 'bg' (for accent-colored buttons)
 */
const ButtonSpinner = ({ color = 'accent' }) => {
    // 'bg' uses the background color (dark on light theme, light on dark theme)
    // 'accent' uses the accent color
    const useBgColor = color === 'charcoal' || color === 'bg';

    // Use CSS variables for theme-aware colors
    const fillColor = useBgColor ? 'var(--color-bg-primary)' : 'var(--color-accent)';

    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <style>
                {`
                    @keyframes pulseBack {
                        0%, 100% { opacity: 0.3; }
                        50% { opacity: 1; }
                    }
                    @keyframes pulseFront {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.3; }
                    }
                    .back-square {
                        animation: pulseBack 1s ease-in-out infinite;
                    }
                    .front-square {
                        animation: pulseFront 1s ease-in-out infinite;
                    }
                `}
            </style>
            {/* Back square (offset) */}
            <rect
                className="back-square"
                x="10"
                y="10"
                width="10"
                height="10"
                rx="2"
                fill={fillColor}
            />
            {/* Front square */}
            <rect
                className="front-square"
                x="4"
                y="4"
                width="10"
                height="10"
                rx="2"
                fill={fillColor}
            />
        </svg>
    );
};

export default ButtonSpinner;
