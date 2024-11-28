/* eslint-disable @typescript-eslint/no-explicit-any */
import chalk from "chalk";

export const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(chalk.blue(message), ...args),
  error: (message: string, ...args: any[]) =>
    console.log(chalk.red.bold(message), ...args),
  success: (message: string, ...args: any[]) =>
    console.log(chalk.green.bold(message), ...args),
};
