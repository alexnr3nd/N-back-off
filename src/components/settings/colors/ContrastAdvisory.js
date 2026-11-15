/* src/components/settings/colors/ContrastAdvisory.js */

import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { wcagContrast, THEME_BG_HEX } from '../../../utils/colorContrast';

const DEBOUNCE_MS = 180;

/**
 * Inline advisory shown next to a color slot when its hex falls below the
 * WCAG 3:1 floor against either theme background. Non-blocking by design —
 * supports the intentional all-similar-colors hue-discrimination training
 * case while still warning users about accidentally invisible colors.
 *
 * Two anti-flicker measures:
 *  1. Container always renders with reserved height so layout doesn't shift
 *     as the advisory toggles on/off.
 *  2. The hex value is debounced before evaluation so the advisory doesn't
 *     flicker while the user is actively dragging the color picker.
 */
const ContrastAdvisory = ({ hex, reserveSpace = true }) => {
    const [debouncedHex, setDebouncedHex] = useState(hex);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedHex(hex), DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [hex]);

    let message = null;
    if (debouncedHex) {
        const darkRatio = wcagContrast(debouncedHex, THEME_BG_HEX.dark);
        const lightRatio = wcagContrast(debouncedHex, THEME_BG_HEX.light);
        const failsDark = !Number.isNaN(darkRatio) && darkRatio < 3;
        const failsLight = !Number.isNaN(lightRatio) && lightRatio < 3;
        if (failsDark && failsLight) message = 'Hard to see in both modes';
        else if (failsDark) message = 'Hard to see in dark mode';
        else if (failsLight) message = 'Hard to see in light mode';
    }

    // Reserve vertical space (~20px) so the parent layout doesn't bounce
    // as the advisory mounts/unmounts.
    return (
        <div
            className="flex items-center gap-1.5 text-xs font-mono text-theme-accent"
            role="status"
            aria-live="polite"
            style={reserveSpace ? { minHeight: '1.25rem' } : undefined}
        >
            {message && (
                <>
                    <FontAwesomeIcon icon={faTriangleExclamation} className="h-3 w-3" />
                    <span>{message}</span>
                </>
            )}
        </div>
    );
};

export default ContrastAdvisory;
