#!/usr/bin/env node

import { build } from "../lib/self-hosted-shared-dependencies.js";
import path from "path";
import minimist from "minimist";
import url from "url";
import { existsSync } from "fs";

const argv = minimist(process.argv.slice(2));

const command = process.env.SHARED_DEPENDENCIES_CONFIG ?? argv._[0] ?? "build";

const configFile = argv._.length > 1 ? argv._[1] : "shared-deps.conf.js";

const configFilePath = path.resolve(process.cwd(), configFile);
const hasConfigFile = existsSync(configFilePath);
if (!hasConfigFile && !argv.usePackageJSON) {
  throw Error(
    "You must either use a config file or use option to use package.json"
  );
}

if (!hasConfigFile && argv.usePackageJSON) {
  build(argv);
} else {
  import(url.pathToFileURL(path.resolve(process.cwd(), configFile)).href)
    .then(async (configModule) => {
      switch (command) {
        case "build":
          await build(Object.assign(configModule.default, argv));
        case "serve":
          break;
        default:
          console.error(
            `self-hosted-shared-dependencies: Invalid CLI command '${command}'`
          );
          process.exit(1);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
