/* src/components/testing/faceNameMemory/FaceNameRecallGrid.js */
import React, { useState, useEffect } from 'react';

/**
 * Recall phase: a studied face + a grid of same-gender studied names. The user
 * taps the name they linked to this face. Every option was studied this
 * session, so familiarity can't carry you — you must retrieve the binding.
 *
 * The face is the subtle "living portrait" VIDEO when the rollout flag put a
 * `video` URL on it (decided server-side), else the still `file`; on any video
 * error it falls back to the still. Purely additive — no `video` renders exactly
 * as before (the Trainer reuses this card and carries no `video`, so it stays
 * on stills). No audio here, so there is nothing to gate on the clip.
 */
const FaceNameRecallGrid = ({ face, options, index, total, phase, onSelect }) => {
    const [videoFailed, setVideoFailed] = useState(false);
    // Reset the fallback when the face changes (the card may update in place).
    useEffect(() => { setVideoFailed(false); }, [face.faceId]);
    const useVideo = !!face.video && !videoFailed;

    return (
        <div className="w-full max-w-lg mx-auto text-center">
            <p className="text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-widest mb-4">
                {phase === 'delayed' ? 'Delayed Recall' : 'Recall'} · {String(index + 1).padStart(String(total).length, '0')} / {total}
            </p>

            {/* Fills available width up to ~85vw (slightly under the study card so
                the 6 name options stay on-screen under the recall timer), capped at
                30rem so desktop is unchanged. w-full + max-w stays container-aware
                (no overflow in the Trainer's padded card). The MEDIA carries
                aspect-square (sized from its own width) so it can't over-shoot the
                box bottom on mobile Safari, and the still `file` posters the video so
                the next face shows instantly instead of a blank-in-frame. */}
            <div className="mx-auto w-full max-w-[85vw] sm:max-w-[30rem] border border-theme-line bg-theme-bg-elevated p-1.5">
                {useVideo ? (
                    <video
                        key={face.video}
                        src={face.video}
                        poster={face.file}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        crossOrigin="anonymous"
                        onError={() => setVideoFailed(true)}
                        className="block w-full aspect-square object-cover"
                        draggable={false}
                    />
                ) : (
                    <img src={face.file} alt="" className="block w-full aspect-square object-cover" draggable={false} />
                )}
            </div>

            <p className="font-serif italic text-theme-text mt-4 mb-4">Whose name is this?</p>

            <div className="grid grid-cols-2 gap-2.5">
                {options.map((name) => (
                    <button
                        key={name}
                        onClick={() => onSelect(name)}
                        className="bg-theme-bg-elevated border border-theme-line px-3 py-3.5 text-sm font-mono text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors truncate"
                    >
                        {name}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FaceNameRecallGrid;
