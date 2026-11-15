/* src/components/program/CohortCountdown.js */

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons';

function getTargetTime(startDate, status, programDay) {
    if (status === 'forming') {
        return new Date(startDate + 'T13:00:00Z');
    }
    // Active: next day boundary = startDate 1pm UTC + programDay days
    const target = new Date(startDate + 'T13:00:00Z');
    target.setUTCDate(target.getUTCDate() + programDay);
    return target;
}

function formatRemaining(ms) {
    if (ms <= 0) return null;

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (days > 0) {
        return `${days}d ${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    }
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
}

const CohortCountdown = ({ startDate, status, programDay }) => {
    const [remaining, setRemaining] = useState(() => {
        const target = getTargetTime(startDate, status, programDay);
        return target.getTime() - Date.now();
    });

    useEffect(() => {
        const target = getTargetTime(startDate, status, programDay);
        setRemaining(target.getTime() - Date.now());

        const interval = setInterval(() => {
            const ms = target.getTime() - Date.now();
            setRemaining(ms);
            if (ms <= 0) clearInterval(interval);
        }, 1000);

        return () => clearInterval(interval);
    }, [startDate, status, programDay]);

    const formatted = formatRemaining(remaining);
    if (!formatted) return null;

    const label = status === 'forming' ? 'Starts in' : 'Next day in';

    return (
        <div className="flex items-center gap-1.5 text-xs font-mono shrink-0">
            <FontAwesomeIcon icon={faClock} className="h-3 w-3 text-theme-text-muted" />
            <span className="text-theme-text-muted uppercase tracking-wider">{label}</span>
            <span className="text-theme-accent">{formatted}</span>
        </div>
    );
};

export default CohortCountdown;
