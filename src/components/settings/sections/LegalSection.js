/* src/components/settings/sections/LegalSection.js
 *
 * View-only Settings → Legal page. Renders the current Health & Safety Notice
 * and surfaces the user's acknowledgment record, plus links to Terms and
 * Privacy Policy.
 *
 * This is NOT the acknowledgment flow — users who haven't acknowledged yet
 * are prompted at their next session-start. This page is for audit/reference
 * after the fact.
 */

import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

import { db } from '../../../firebaseConfig';
import { useUser } from '../../../contexts/UserContext';
import { isNative } from '../../../utils/platform';
import {
    CURRENT_NOTICE_VERSION,
    getCurrentNotice,
} from '../../../notices/healthSafety';

const TERMS_HREF = 'https://dualnback.com/terms';
const PRIVACY_HREF = 'https://dualnback.com/privacy';

const LegalSection = () => {
    const { userId } = useUser();
    const [ackData, setAckData] = useState(null);
    const [loadingAck, setLoadingAck] = useState(true);
    const [appVersion, setAppVersion] = useState(null);

    const notice = getCurrentNotice();

    // Installed app version (native only — App.getInfo() throws on web, where
    // the deployed bundle is always current). Lets users read their installed
    // build to support, since the Play Store hides it.
    useEffect(() => {
        if (!isNative()) return;
        let cancelled = false;
        (async () => {
            try {
                const { App } = await import('@capacitor/app');
                const info = await App.getInfo();
                if (!cancelled) setAppVersion(`${info.version} (${info.build})`);
            } catch (err) {
                // Render nothing on failure
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!userId) {
            setLoadingAck(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const ref = doc(
                    db,
                    'users',
                    userId,
                    'healthSafetyAcknowledgments',
                    CURRENT_NOTICE_VERSION
                );
                const snap = await getDoc(ref);
                if (cancelled) return;
                setAckData(snap.exists() ? snap.data() : null);
            } catch (err) {
                console.warn('[LegalSection] Failed to load acknowledgment:', err?.message);
            } finally {
                if (!cancelled) setLoadingAck(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    if (!notice) {
        return (
            <p className="text-sm font-mono text-theme-text-secondary">
                The current notice is unavailable. Please check back later.
            </p>
        );
    }

    const ackTimestamp = ackData?.acknowledgedAt?.toDate?.();
    const ackStatusText = loadingAck
        ? 'Loading…'
        : ackTimestamp
            ? `Acknowledged on ${ackTimestamp.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
            : 'Not yet acknowledged. The notice will appear before your next training session.';

    const renderBullet = (b, idx) => {
        if (typeof b === 'string') {
            return <li key={idx} className="text-theme-text-secondary">{b}</li>;
        }
        return (
            <li key={idx} className="text-theme-text-secondary">
                <span className="text-theme-text font-semibold">{b.label}</span> {b.body}
            </li>
        );
    };

    return (
        <div className="space-y-6">
            {/* Status banner */}
            <div className="p-4 border border-theme-line bg-theme-bg-elevated rounded-lab">
                <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-1">
                    Health &amp; Safety Notice
                </p>
                <p className="text-sm font-mono text-theme-text">
                    Version <span className="text-theme-accent">{notice.version}</span>
                </p>
                <p className="text-xs font-mono text-theme-text-secondary mt-1">
                    {ackStatusText}
                </p>
            </div>

            {/* Quick links */}
            <div className="flex flex-wrap gap-4 text-sm font-mono">
                <a
                    href={TERMS_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-theme-accent hover:text-amber-highlight underline underline-offset-2 inline-flex items-center gap-1.5"
                >
                    Terms of Use
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" />
                </a>
                <a
                    href={PRIVACY_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-theme-accent hover:text-amber-highlight underline underline-offset-2 inline-flex items-center gap-1.5"
                >
                    Privacy Policy
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3" />
                </a>
            </div>

            {/* Installed app version (native app only) */}
            {appVersion && (
                <p className="text-xs font-mono text-theme-text-muted">
                    App version <span className="text-theme-text-secondary">{appVersion}</span>
                </p>
            )}

            {/* Notice body */}
            <article className="space-y-4 text-sm font-mono text-theme-text-secondary">
                <h3 className="text-base font-serif text-theme-text">{notice.title}</h3>
                <p>{notice.intro}</p>
                {notice.sections.map((section, i) => (
                    <div key={i} className="space-y-1.5">
                        <p className="text-theme-text font-semibold">{section.heading}</p>
                        {section.bullets && (
                            <ul className="list-disc pl-5 space-y-1">
                                {section.bullets.map(renderBullet)}
                            </ul>
                        )}
                        {section.body && <p>{section.body}</p>}
                    </div>
                ))}
            </article>

            <p className="text-[0.625rem] font-mono text-theme-text-muted/70">
                Health &amp; Safety Notice v{notice.version} ({notice.locale})
            </p>
        </div>
    );
};

export default LegalSection;
