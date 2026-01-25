/**
 * Prebuilt Normalizers
 *
 * Ready-to-use normalizer implementations for converting metric values to scores.
 */

export {
  createMinMaxNormalizer,
  createZScoreNormalizer,
  createThresholdNormalizer,
  createLinearNormalizer,
  createOrdinalMapNormalizer,
  createIdentityNormalizer,
  createCustomNormalizer,
} from './factories';

// Re-export core normalization utilities
export { applyNormalization } from '../core/normalization/apply';

export {
  resolveCalibration,
  computeDistributionStats,
  computeRange,
  createCalibrationCache,
} from '../core/normalization/context';
