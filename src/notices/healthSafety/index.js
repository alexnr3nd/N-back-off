/* src/notices/healthSafety/index.js
 *
 * Registry of Health & Safety Notice versions.
 *
 * CURRENT_NOTICE_VERSION   — the version new acknowledgments must record.
 * KNOWN_NOTICE_VERSIONS    — every version we have ever published (used by
 *                            the Cloud Function to reject unknown versions).
 * getNotice(version)       — returns the archived notice module for a version.
 *
 * When the notice content materially changes:
 *   1. Copy the prior dated file to a new dated file and edit the new file.
 *   2. Import it below, add it to NOTICES, add its date to KNOWN_NOTICE_VERSIONS.
 *   3. Bump CURRENT_NOTICE_VERSION to the new date.
 *   4. Add the same string to functions/acknowledgments.js KNOWN_NOTICE_VERSIONS.
 */

import notice2026_04_22 from './2026-04-22';

const NOTICES = {
    '2026-04-22': notice2026_04_22,
};

export const CURRENT_NOTICE_VERSION = '2026-04-22';

export const KNOWN_NOTICE_VERSIONS = Object.keys(NOTICES);

export const getNotice = (version) => NOTICES[version] || null;

export const getCurrentNotice = () => NOTICES[CURRENT_NOTICE_VERSION];
