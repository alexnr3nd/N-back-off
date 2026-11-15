/* src/components/testing/digitSpan/trainer/DigitSpanTrainerResults.js */
/**
 * Digit Span Trainer session-complete screen — a thin config wrapper around the
 * shared generic TrainerResults chassis (Span noun; per-direction ceiling).
 */
import React from 'react';
import PropTypes from 'prop-types';
import { faListOl } from '@fortawesome/free-solid-svg-icons';
import TrainerResults from '../../trainer/TrainerResults';
import { boundsFor } from '../../../../constants/digitSpanTrainerConstants';

const DigitSpanTrainerResults = ({ direction, ...props }) => (
    <TrainerResults {...props} icon={faListOl} levelLabel="Span" maxLevel={boundsFor(direction).MAX_SPAN} showMaxBadge />
);

DigitSpanTrainerResults.propTypes = { direction: PropTypes.string };

export default DigitSpanTrainerResults;
