import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faShieldHalved, faUsers, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { faDiscord, faRedditAlien } from '@fortawesome/free-brands-svg-icons';

const AboutContent = () => {
    return (
        <div className="space-y-8">
            {/* Mission */}
            <section>
                <div className="flex items-center mb-3">
                    <FontAwesomeIcon icon={faShieldHalved} className="text-theme-accent mr-2 h-4 w-4" />
                    <h2 className="text-lg font-serif text-theme-text">Our Mission</h2>
                </div>
                <div className="specimen-card p-4 space-y-4">
                    <blockquote className="border-l-2 border-theme-accent pl-4 py-1">
                        <p className="text-base sm:text-lg font-serif italic text-theme-text leading-relaxed">
                            To take dual n-back out of labs and forums and into the everyday lives of
                            students, parents, and lifelong learners.
                        </p>
                    </blockquote>
                    <div className="text-sm text-theme-text-secondary font-mono">
                        <p>
                            Dual n-back has lived in labs and forums for too long. We&apos;re here to bring
                            it to the everyday person&nbsp;&mdash; the student, the parent, the lifelong
                            learner&nbsp;&mdash; and shape the practice around the person, not the protocol.
                        </p>
                    </div>
                </div>
            </section>

            {/* What We Do */}
            <section>
                <div className="flex items-center mb-3">
                    <FontAwesomeIcon icon={faBrain} className="text-theme-accent mr-2 h-4 w-4" />
                    <h2 className="text-lg font-serif text-theme-text">What We Do</h2>
                </div>
                <div className="specimen-card p-4 space-y-3 text-sm text-theme-text-secondary font-mono">
                    <p>
                        Dual n-back training challenges you to track two streams of information
                        simultaneously&nbsp;&mdash; visual positions and audio letters&nbsp;&mdash; stretching
                        your working memory to its limits. Decades of cognitive science research back its
                        effectiveness.
                    </p>
                    <p>
                        Our app adapts to your skill level with every session, using signal detection
                        theory to find the sweet spot where you&apos;re challenged but not overwhelmed. No two
                        training sessions are the same, and you&apos;re always progressing.
                    </p>
                    <p>
                        Whether you&apos;re a student looking to sharpen your focus, a professional keeping
                        your mind agile, or just someone who wants a better brain&nbsp;&mdash; we built
                        this for you.
                    </p>
                </div>
            </section>

            {/* Community */}
            <section>
                <div className="flex items-center mb-3">
                    <FontAwesomeIcon icon={faUsers} className="text-theme-accent mr-2 h-4 w-4" />
                    <h2 className="text-lg font-serif text-theme-text">Community</h2>
                </div>
                <div className="specimen-card p-4 space-y-3 text-sm text-theme-text-secondary font-mono">
                    <p>
                        We&apos;re a growing community of people committed to keeping their brains sharp. Join the conversation:
                    </p>
                    <div className="flex flex-wrap gap-3 pt-1">
                        <a
                            href="https://discord.gg/yC48K6qM4s"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-theme-accent/10 text-theme-accent hover:bg-theme-accent/20 transition-colors text-sm"
                        >
                            <FontAwesomeIcon icon={faDiscord} className="h-4 w-4" />
                            <span>Discord</span>
                        </a>
                        <a
                            href="https://www.reddit.com/r/DualnBack/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-theme-accent/10 text-theme-accent hover:bg-theme-accent/20 transition-colors text-sm"
                        >
                            <FontAwesomeIcon icon={faRedditAlien} className="h-4 w-4" />
                            <span>Reddit</span>
                        </a>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section>
                <div className="flex items-center mb-3">
                    <FontAwesomeIcon icon={faEnvelope} className="text-theme-accent mr-2 h-4 w-4" />
                    <h2 className="text-lg font-serif text-theme-text">Contact</h2>
                </div>
                <div className="specimen-card p-4 text-sm text-theme-text-secondary font-mono">
                    <p>
                        Questions or feedback? Reach us at{' '}
                        <a href="mailto:support@dualnback.com" className="text-theme-accent hover:underline">
                            support@dualnback.com
                        </a>
                    </p>
                </div>
            </section>
        </div>
    );
};

export default AboutContent;
