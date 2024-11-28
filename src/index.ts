#!/usr/bin/env node
import { program } from "commander";
import { startAuthFlow, startDriveUploadFlow } from "./commands-handlers";

async function main() {
  program
    .name("gds")
    .description("CLI to GDS")
    .version("1.0.0")
    .command("upload")
    .option("-n, --new", "Uploads a new zip file", false)
    .action((options) => startDriveUploadFlow({ newFile: options.new }));
  program.command("auth").action(() => startAuthFlow());
  program.parse();
}

main();
