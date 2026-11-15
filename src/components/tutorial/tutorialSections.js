/* src/components/tutorial/tutorialSections.js */
/* Protocol Guide - Section Definitions */

/**
 * Defines the main sections of the Protocol Guide.
 * Each section contains multiple steps from tutorialSteps.js.
 */

export const TUTORIAL_SECTIONS = [
  {
    id: 'intro',
    phase: 'intro',
    title: 'Introduction',
    description: 'What is Dual N-Back and how it works',
    icon: '?',
    estimatedTime: '1 min',
  },
  {
    id: 'visual',
    phase: '2back-visual',
    title: 'Position Training',
    description: 'Learn to track visual positions on the grid',
    icon: '□',
    estimatedTime: '2 min',
  },
  {
    id: 'audio',
    phase: '2back-audio',
    title: 'Audio Training',
    description: 'Learn to track spoken letters',
    icon: '♪',
    estimatedTime: '2 min',
  },
  {
    id: 'dual',
    phase: 'dual',
    title: 'Dual N-Back',
    description: 'Combine position and audio tracking',
    icon: '⚡',
    estimatedTime: '2 min',
  },
  {
    id: 'progression',
    phase: 'progression',
    title: 'Training Modes',
    description: 'Classic and Adaptive training explained',
    icon: '⚙',
    estimatedTime: '1 min',
  },
  {
    id: 'dashboard-tour',
    phase: 'dashboard-tour',
    title: 'Dashboard Tour',
    description: 'Learn your way around the interface',
    icon: '⊞',
    estimatedTime: '1 min',
    isExternal: true, // This section navigates to /dashboard
  },
];

export const TOTAL_SECTIONS = TUTORIAL_SECTIONS.length;

/**
 * Sections narrowed to the viewer's cohort. Users without Classic access see the
 * same section list, but the progression section is retitled — it still carries the
 * Adaptive explanation they need, it just no longer promises two modes.
 * Section ids are unchanged so `tutorialsCompleted` records stay valid.
 */
export const getTutorialSections = ({ hasClassicAccess = true } = {}) =>
  TUTORIAL_SECTIONS.map(section => {
    if (section.id !== 'progression' || hasClassicAccess) return section;
    return {
      ...section,
      title: 'Progression',
      description: 'How levels and difficulty work',
    };
  });

export const getSectionById = (id) => TUTORIAL_SECTIONS.find(s => s.id === id);

export const getSectionIndex = (id) => TUTORIAL_SECTIONS.findIndex(s => s.id === id);

// Get the next section after a given section id
export const getNextSection = (currentId) => {
  const currentIndex = getSectionIndex(currentId);
  if (currentIndex >= 0 && currentIndex < TUTORIAL_SECTIONS.length - 1) {
    return TUTORIAL_SECTIONS[currentIndex + 1];
  }
  return null;
};
