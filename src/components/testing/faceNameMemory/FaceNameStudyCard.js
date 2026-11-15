/* src/components/testing/faceNameMemory/FaceNameStudyCard.js */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeHigh } from '@fortawesome/free-solid-svg-icons';
import { playName, unlockNameAudio } from './hooks/nameAudio';

// The clips are seamless loops: their final ~0.5s crossfades the start back
// over the end so the RECALL phase can loop without a visible jump. In STUDY
// each clip plays through exactly once, so that crossfade would otherwise show
// as a brief blurry double-exposure right before the card switches. We pause on
// the last clean frame (just before the tail) so memorize never shows the
// blend. Must match the generator's xfade length (generate-face-videos-veo.ps1 $T).
const CROSSFADE_TAIL_S = 0.5;

/**
 * Study phase: a face shown while its name is spoken aloud (Chirp3-HD voice).
 * AUDIO-ONLY by design — the name is never shown as text here, so the binding
 * must be formed between the face and the heard name. The speaker control
 * replays on tap. Advancement is purely TIME-BASED (the logic hook's per-card
 * timer) — there is no manual "next", so every face gets the same fixed exposure.
 *
 * The face is a subtle "living portrait" VIDEO when the rollout flag put a
 * `video` URL on the pair (config/faceNameMemoryVideoRollout, decided server-
 * side); otherwise it is the still `file`. On any video error it falls back to
 * the still — purely additive, so the flag-off path renders exactly as before.
 *
 * The auto-played name is GATED on the media being ready (the video's
 * onLoadedData/onCanPlayThrough, or the image being decoded/painted), so the
 * name is never heard before the face is on screen. A 1.5s safety-net timer
 * still speaks if the media is blocked/errors. Shared by the assessment and the
 * Trainer (the Trainer's pairs carry no `video`, so it stays on stills).
 */
const FaceNameStudyCard = ({ pair, index, total, pass, totalPasses }) => {
    const imgRef = useRef(null);
    const videoRef = useRef(null);
    const spokenRef = useRef(false);
    const [videoFailed, setVideoFailed] = useState(false);
    const useVideo = !!pair.video && !videoFailed;

    // Speak the name at most once per card.
    const speak = useCallback(() => {
        if (spokenRef.current) return;
        spokenRef.current = true;
        playName(pair.name);
    }, [pair.name]);

    useEffect(() => {
        spokenRef.current = false;   // new card -> re-arm (also handles repeated/shared names)
        setVideoFailed(false);       // new card -> try the video again
        let cancelled = false;
        const guarded = () => { if (!cancelled) speak(); };
        // Already-ready cache-hit case where the media's load event may not fire:
        // a buffered video (readyState >= HAVE_CURRENT_DATA) or a decoded image.
        const vid = videoRef.current;
        if (vid && vid.readyState >= 2) {
            guarded();
        } else {
            const img = imgRef.current;
            if (img && img.complete && img.naturalWidth > 0) {
                if (img.decode) img.decode().then(guarded).catch(guarded); else guarded();
            }
        }
        // Safety net: if no ready/decode event resolves (blocked/errored media), still speak.
        const t = setTimeout(guarded, 1500);
        return () => { cancelled = true; clearTimeout(t); };
    }, [index, pair.file, pair.video, speak]);

    // Pause the study clip on its last clean frame, just before the seamless-loop
    // crossfade tail — so memorize never shows the blurry blend (recall, which
    // loops, is unaffected: it uses the looping FaceNameRecallGrid card). rAF
    // polls actual currentTime so a buffering stall can't pause it early.
    useEffect(() => {
        if (!useVideo) return undefined;
        let raf = 0;
        const tick = () => {
            const v = videoRef.current;
            if (v && !v.paused) {
                const d = v.duration;
                if (Number.isFinite(d) && d > 1 && v.currentTime >= d - CROSSFADE_TAIL_S - 0.05) {
                    try { v.pause(); } catch (e) { /* ignore */ }
                    return;   // frozen on the last clean frame; stop polling
                }
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { if (raf) cancelAnimationFrame(raf); };
    }, [index, pair.video, useVideo]);

    const handleImgLoad = useCallback(() => {
        const img = imgRef.current;
        if (img && img.decode) img.decode().then(speak).catch(speak); else speak();
    }, [speak]);

    // Video unavailable/errored -> drop to the still; its onLoad (or the safety
    // net) then speaks the name.
    const handleVideoError = useCallback(() => setVideoFailed(true), []);

    return (
        <div className="w-full max-w-lg mx-auto text-center">
            <p className="text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-widest mb-4">
                Memorize · {String(index + 1).padStart(String(total).length, '0')} / {total}{totalPasses > 1 ? ` · Pass ${pass}/${totalPasses}` : ''}
            </p>

            {/* Framed portrait — specimen plate. Fills the available width up to
                ~88vw (near-full width with small gutters in the assessment's
                full-bleed layout), capped at 30rem so desktop is unchanged. w-full +
                max-w keeps it container-aware so it can't overflow the Trainer's
                padded card. The MEDIA carries aspect-square (sized from its own
                width) and the box wraps it — NOT h-full against a box aspect-ratio,
                which over-shoots the bottom on mobile Safari. The still `file` is the
                video's poster, so the face shows instantly while the clip decodes
                (no blank-in-frame between cards). */}
            <div className="mx-auto w-full max-w-[88vw] sm:max-w-[30rem] border border-theme-line bg-theme-bg-elevated p-1.5">
                {useVideo ? (
                    <video
                        key={pair.video}
                        ref={videoRef}
                        src={pair.video}
                        poster={pair.file}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        crossOrigin="anonymous"
                        onLoadedData={speak}
                        onCanPlayThrough={speak}
                        onError={handleVideoError}
                        className="block w-full aspect-square object-cover"
                        draggable={false}
                    />
                ) : (
                    <img
                        ref={imgRef}
                        src={pair.file}
                        onLoad={handleImgLoad}
                        onError={speak}
                        alt=""
                        className="block w-full aspect-square object-cover"
                        draggable={false}
                    />
                )}
            </div>

            {/* Audio-only name: a speaker control, no text */}
            <button
                type="button"
                onClick={() => { unlockNameAudio(); playName(pair.name); }}
                aria-label="Hear the name"
                className="group mt-5 inline-flex items-center gap-3 bg-theme-bg-elevated border border-theme-line px-5 py-3 hover:border-theme-accent transition-colors"
            >
                <FontAwesomeIcon icon={faVolumeHigh} className="h-5 w-5 text-theme-accent group-hover:scale-110 transition-transform" />
                <span className="text-sm font-mono text-theme-text-secondary uppercase tracking-wider">Hear the name</span>
            </button>
            <p className="text-[0.625rem] font-mono text-theme-text-muted/70 uppercase tracking-wider mt-2">
                Listen and link it to this face · tap to replay
            </p>
        </div>
    );
};

export default FaceNameStudyCard;
