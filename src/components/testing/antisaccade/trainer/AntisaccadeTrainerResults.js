/* src/components/testing/antisaccade/trainer/AntisaccadeTrainerResults.js */
/**
 * Antisaccade Trainer session-complete screen — a thin config wrapper around the
 * shared generic TrainerResults chassis (Level noun, 1–26 ceiling).
 */
import React from 'react';
import { faDumbbell } from '@fortawesome/free-solid-svg-icons';
import TrainerResults from '../../trainer/TrainerResults';
import { MAX_LEVEL } from '../../../../constants/antisaccadeTrainerConstants';

const AntisaccadeTrainerResults = (props) => (
    <TrainerResults {...props} icon={faDumbbell} levelLabel="Level" maxLevel={MAX_LEVEL} showMaxBadge />
);

export default AntisaccadeTrainerResults;
