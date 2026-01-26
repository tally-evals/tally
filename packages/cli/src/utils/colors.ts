/**
 * Color and styling utilities
 */

import chalk from 'chalk';

export const colors = {
  success: (text: string) => chalk.greenBright(text),
  error: (text: string) => chalk.redBright(text),
  warning: (text: string) => chalk.yellowBright(text),
  info: (text: string) => chalk.blueBright(text),
  muted: (text: string) => chalk.gray(text),
  bold: (text: string) => chalk.blueBright.bold(text),
  dim: (text: string) => chalk.dim(text),
};

export const score = {
  excellent: (text: string) => chalk.green.bold(text),
  good: (text: string) => chalk.greenBright(text),
  fair: (text: string) => chalk.yellowBright(text),
  poor: (text: string) => chalk.redBright(text),
  neutral: (text: string) => chalk.gray(text),
};

export const verdict = {
  pass: () => chalk.greenBright.bold('✓'),
  fail: () => chalk.redBright.bold('✗'),
  unknown: () => chalk.gray.bold('?'),
};
