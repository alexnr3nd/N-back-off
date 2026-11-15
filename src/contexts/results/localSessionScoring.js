import { isTrialMatch } from '../gameHelpers';
import { determineProgression } from './progressionLogic';
import { DPRIME_THRESHOLDS_INTERPRETATION, DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS } from '../../constants/gameConstants';

const inverseNormal = (p) => {
  // Peter Acklam's rational approximation to the inverse standard-normal CDF.
  const a = [-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924];
  const b = [-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857];
  const c = [-0.00778489400243029,-0.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878];
  const d = [0.00778469570904146,0.32246712907004,2.445134137143,3.75440866190742];
  const x = Math.min(0.999999, Math.max(0.000001, p));
  if (x < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(x));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
      ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (x > 0.97575) {
    const q = Math.sqrt(-2 * Math.log(1-x));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
      ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  const q = x - 0.5, r = q*q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
    (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
};

const scoreModality = (sequence, nBack, type, responses) => {
  const total = Math.max(0, sequence.length - nBack);
  const targets = [];
  for (let i = nBack; i < sequence.length; i++) if (isTrialMatch(sequence, i, nBack, type)) targets.push(i);
  const targetSet = new Set(targets);
  const responseSet = new Set((responses || []).filter(i => Number.isInteger(i) && i >= nBack && i < sequence.length));
  let hits = 0;
  let falseAlarms = 0;
  for (const index of responseSet) targetSet.has(index) ? hits++ : falseAlarms++;
  const misses = Math.max(0, targets.length - hits);
  const nonTargets = Math.max(0, total - targets.length);
  const correctRejections = Math.max(0, nonTargets - falseAlarms);
  const hitRate = (hits + 0.5) / (targets.length + 1);
  const falseAlarmRate = (falseAlarms + 0.5) / (nonTargets + 1);
  const dprime = inverseNormal(hitRate) - inverseNormal(falseAlarmRate);
  const accuracy = total > 0 ? (hits + correctRejections) / total : 0;
  return { accuracy, dprime, hits, misses, falseAlarms, correctRejections, targetCount: targets.length, total };
};

export const calculateLocalSessionResults = ({
  sessionData, visualResponses = [], audioResponses = [], colorResponses = [], shapeResponses = [],
  activeProfile, settings = {}, sessionId, totalSessions = 0, durationMs = 0,
}) => {
  const sequence = sessionData.sequence || [];
  const nBack = Math.max(1, Number(sessionData.nBack) || 1);
  const difficulty = Math.max(0, Math.min(0.99, Number(sessionData.difficulty) || 0));
  const gameMode = sessionData.gameMode || 'dual';
  const modes = {
    dual: ['visual','audio'], triple: ['visual','audio','color'], quad: ['visual','audio','color','shape'],
    singleVisual: ['visual'], singleAudio: ['audio'], singleColor: ['color'], singleShape: ['shape'],
    singleColorRecall: ['color'],
  };
  const active = modes[gameMode] || modes.dual;
  const responseMap = { visual: visualResponses, audio: audioResponses, color: colorResponses, shape: shapeResponses };
  const scores = {};
  active.forEach(type => { scores[type] = scoreModality(sequence, nBack, type, responseMap[type]); });
  const average = key => active.length ? active.reduce((sum,type) => sum + scores[type][key],0) / active.length : 0;
  const overallDprime = average('dprime');
  const overallAccuracy = average('accuracy');
  const range = DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS.find(item => item.key === settings.difficultyAdjustmentRange)?.range
    || DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS[0].range;
  const thresholds = {
    excellentThreshold: DPRIME_THRESHOLDS_INTERPRETATION.EXCELLENT,
    goodThreshold: DPRIME_THRESHOLDS_INTERPRETATION.GOOD,
    fairThreshold: DPRIME_THRESHOLDS_INTERPRETATION.FAIR,
  };
  const currentMode = gameMode === 'singleColorRecall' ? (activeProfile?.recallProgression || activeProfile || {}) : (activeProfile?.modeProgression?.[gameMode] || activeProfile || {});
  let progression = { newNBack: nBack, newDifficulty: difficulty, newConsecutiveSuccesses: currentMode.consecutiveSuccesses || 0, difficultyAdjustment: 0 };
  if (sessionData.saveToProfile && sessionData.trainingMode !== 'classic') {
    progression = determineProgression({
      overallDprime, thresholds, nBack,
      difficulty, consecutiveSuccesses: currentMode.consecutiveSuccesses || 0,
      highestAchievedNBack: currentMode.highestNBack || nBack,
      adjustmentRange: range,
      allowEarlyPromotion: true,
      promotionCredits: currentMode.promotionCredits || 0,
    });
  }
  return {
    sessionId, nBack, difficulty, gameMode, trainingMode: sessionData.trainingMode || 'adaptive',
    overallDprime, overallAccuracy,
    visualAccuracy: scores.visual?.accuracy ?? null, visualDprime: scores.visual?.dprime ?? null,
    audioAccuracy: scores.audio?.accuracy ?? null, audioDprime: scores.audio?.dprime ?? null,
    colorAccuracy: scores.color?.accuracy ?? null, colorDprime: scores.color?.dprime ?? null,
    shapeAccuracy: scores.shape?.accuracy ?? null, shapeDprime: scores.shape?.dprime ?? null,
    hits: active.reduce((sum,type) => sum + scores[type].hits,0),
    misses: active.reduce((sum,type) => sum + scores[type].misses,0),
    falseAlarms: active.reduce((sum,type) => sum + scores[type].falseAlarms,0),
    correctRejections: active.reduce((sum,type) => sum + scores[type].correctRejections,0),
    totalTrials: sessionData.trialsCompleted || sequence.length,
    durationMs, newNBack: progression.newNBack, newDifficulty: progression.newDifficulty,
    newConsecutiveSuccesses: progression.newConsecutiveSuccesses,
    newPromotionCredits: progression.newPromotionCredits || 0,
    difficultyAdjustment: progression.difficultyAdjustment || 0,
    totalSessions: totalSessions + 1, showReport: sessionData.showReport !== false,
    isPartialResult: sessionData.isPartialResult === true,
  };
};
