import path from "path";
import _rimraf from "rimraf";
import util from "util";
import npmFetch from "npm-registry-fetch";
import semver from "semver";
import tar from "tar";
import fs from "fs/promises";
import mkdirp from "mkdirp";
import https from "https";
import http from "http";
import micromatch from "micromatch";
import url from "url";
import ejs from "ejs";

const rimraf = util.promisify(_rimraf);
const renderFile = util.promisify(ejs.renderFile);

const errPrefix = `self-hosted-shared-dependencies:`;

const logLevels = {
  debug: 0,
  warn: 1,
  fatal: 2,
};

/**
 *
 * @typedef {{
 * version: string,
 * include?: string[]
 * exclude?: string[]
 * } | string}  PackageVersion
 *
 * @typedef {{
 *  name: string,
 *  versions: PackageVersion[]
 *  include?: string[],
 *  exclude?: string[],
 * }} PackageToBuild
 *
 * @typedef {{
 *  packages: PackageToBuild[],
 *  outputDir?: string,
 *  clean?: boolean,
 *  logLevel?: 'debug' | 'warn' | 'fatal',
 *  absoluteDir?: boolean,
 *  skipPackagesAtUrl?: string,
 *  generateDockerfile?: boolean,
 * }} BuildOpts
 *
 * @param {BuildOpts} opts
 */
export async function build({
  clean,
  outputDir,
  packages,
  logLevel,
  absoluteDir,
  skipPackagesAtUrl,
  generateDockerfile,
}) {
  const start = Date.now();

  if (!outputDir) {
    outputDir = "npm";
  }

  if (typeof outputDir !== "string") {
    throw Error(`${errPrefix} outputDir must be a string`);
  }

  if (!Array.isArray(packages)) {
    throw Error(`${errPrefix} Invalid packages option - must be array`);
  }

  if (typeof clean !== "undefined" && typeof clean !== "boolean") {
    throw Error(`${errPrefix} clean option must be a boolean`);
  }

  if (clean && path.isAbsolute(outputDir) && !absoluteDir) {
    throw Error(
      `${errPrefix} outputDir may not be an absolute path when clean is true, as a precaution against unintentional deletion of important directories. To bypass this precaution, set absoluteDir: true in your config`
    );
  }

  if (logLevel && !["debug", "warn", "fatal"].includes(logLevel)) {
    throw Error(
      `${errPrefix} logLevel must be one of the following: "debug", "warn", "fatal"`
    );
  }

  let logLevelInt;

  if (logLevels.hasOwnProperty(logLevel)) {
    logLevelInt = logLevels[logLevel];
  } else {
    logLevelInt = 0;
  }

  if (skipPackagesAtUrl && typeof skipPackagesAtUrl !== "string") {
    throw Error(`${errPrefix} skipPackagesAtUrl must be a string`);
  }

  packages.forEach((p, i) => {
    if (typeof p !== "object" || !p) {
      throw Error(
        `${errPrefix} Invalid package at index ${i} - must be an object`
      );
    }

    if (typeof p.name !== "string") {
      throw Error(
        `${errPrefix} Invalid package at index ${i} - package.name must be a string`
      );
    }

    if (!Array.isArray(p.versions)) {
      throw Error(
        `${errPrefix} Invalid package ${p.name} at index ${i} - package.versions must be an array`
      );
    }

    p.versions.forEach((version, j) => {
      if (typeof version !== "string") {
        if (typeof version !== "object" || !version) {
          throw Error(
            `${errPrefix} Invalid package ${p.name} at index ${i} - invalid version at index ${j} - must be a string or object`
          );
        }

        if (
          typeof version.version !== "string" ||
          !semver.valid(version.version)
        ) {
          throw Error(
            `${errPrefix} Invalid package ${p.name} - packages[${i}].versions[${i}].version must be a valid semver string`
          );
        }

        if (
          version.hasOwnProperty("include") &&
          (!Array.isArray(version.include) ||
            version.include.some((k) => typeof k !== "string"))
        ) {
          throw Error(
            `${errPrefix} Invalid package ${p.name} - packages[${i}].versions[${i}].include must be an array of strings, if defined`
          );
        }

        if (
          version.hasOwnProperty("exclude") &&
          (!Array.isArray(version.exclude) ||
            version.exclude.some((k) => typeof k !== "string"))
        ) {
          throw Error(
            `${errPrefix} Invalid package ${p.name} - packages[${i}].versions[${i}].exclude must be an array of strings, if defined`
          );
        }
      }
    });

    if (
      p.hasOwnProperty("include") &&
      (!Array.isArray(p.include) ||
        p.include.some((k) => typeof k !== "string"))
    ) {
      throw Error(
        `${errPrefix} Invalid package ${p.name} - packages[${i}].include must be an array of strings, if defined`
      );
    }

    if (
      p.hasOwnProperty("exclude") &&
      (!Array.isArray(p.exclude) ||
        p.exclude.some((k) => typeof k !== "string"))
    ) {
      throw Error(
        `${errPrefix} Invalid package ${p.name} - packages[${i}].exclude must be an array of strings, if defined`
      );
    }
  });

  if (clean) {
    await rimraf(outputDir);
  }

  warn(
    `Building ${packages.length.toLocaleString()} packages concurrently (with cache)`
  );

  const packagePromises = packages.map(buildPackage);

  await mkdirp(outputDir);

  for (let packagePromise of packagePromises) {
    for await (let logValue of packagePromise) {
      log(...logValue);
    }
  }

  if (generateDockerfile) {
    warn(`Creating ${outputDir}/Dockerfile`);
    const Dockerfile = await renderFile(
      url.fileURLToPath(new url.URL("Dockerfile.ejs", import.meta.url)),
      { outputDir },
      {}
    );
    await fs.writeFile(path.resolve(outputDir, "Dockerfile"), Dockerfile);
  }

  warn(`Finished build in ${(Date.now() - start) / 1000} seconds`);

  /**
   *
   * @param {PackageToBuild} p
   */
  async function* buildPackage(p) {
    let metadata;

    yield [logLevels.warn, `--> ${p.name}`];

    try {
      metadata = await npmFetch.json(`/${p.name}`);
    } catch (err) {
      yield [logLevels.warn, err];
      return yield [
        logLevels.fatal,
        `----> No package '${p.name}' found in the npm registry`,
      ];
    }

    const matchedVersions = Object.keys(metadata.versions).filter((version) =>
      p.versions.some((v) => semver.satisfies(version, v))
    );

    if (matchedVersions.length > 0) {
      yield [
        logLevels.debug,
        `----> Matched versions: ${matchedVersions.join(", ")}`,
      ];
    } else {
      return yield [logLevels.fatal, `----> No matching versions`];
    }

    const versionLogs = matchedVersions.map(processVersion);

    for (let versionLog of versionLogs) {
      for await (let log of versionLog) {
        yield log;
      }
    }

    async function* processVersion(matchedVersion) {
      if (skipPackagesAtUrl) {
        const cacheCheckpath = new url.URL(
          `${p.name}@${matchedVersion}/package.json`,
          skipPackagesAtUrl
        );
        const shouldSkip = await new Promise((resolve, reject) => {
          const stream = (cacheCheckpath.href.startsWith("http://")
            ? http
            : https
          ).request(cacheCheckpath);
          stream.on("response", (response) => {
            resolve(response.statusCode >= 200 && response.statusCode < 300);
          });
          stream.on("error", (err) => {
            reject(err);
          });
          stream.end();
        });

        if (shouldSkip) {
          return yield [
            logLevels.warn,
            `----> Skipping ${p.name}@${matchedVersion} because it is already available at URL ${cacheCheckpath.href}`,
          ];
        }
      }

      const dir = path.resolve(outputDir, `${p.name}@${matchedVersion}`);

      yield [
        logLevels.warn,
        `----> Downloading and extracting ${p.name}@${matchedVersion}`,
      ];

      try {
        await fs.stat(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }

      const include = matchedVersion.include || p.include || [];
      const exclude = matchedVersion.exclude || p.exclude || [];

      let files = [];

      await new Promise((resolve, reject) => {
        const untarStream = tar.extract({
          cwd: dir,
          filter(path, entry) {
            const filePath = path.slice("package/".length);

            if (isLicense(filePath) || isPackageJson(filePath)) {
              files.push(filePath);
              return true;
            }

            const included =
              include.length > 0 ? micromatch.isMatch(filePath, include) : true;
            const excluded =
              exclude.length > 0
                ? micromatch.isMatch(filePath, exclude)
                : false;

            if (included && !excluded) {
              files.push(filePath);
              return true;
            } else {
              return false;
            }
          },
          strip: 1,
        });

        const tarballUrl = metadata.versions[matchedVersion].dist.tarball;
        const requestStream = https.request(tarballUrl);

        requestStream.on("response", (responseStream) => {
          responseStream.pipe(untarStream);
        });

        requestStream.on("timeout", () => {
          reject(
            Error(
              `Request timed out to download tarball for ${p.name}@${matchedVersion}`
            )
          );
        });

        requestStream.on("error", (err) => {
          reject(err);
        });

        requestStream.end();

        untarStream.on("end", () => {
          resolve();
        });

        untarStream.on("error", (err) => {
          reject(err);
        });
      });

      for (let file of files) {
        yield [logLevels.debug, `------> ${file}`];
      }
    }
  }

  function log(priority, msg) {
    if (priority === 0) {
      debug(msg);
    } else if (priority === 1) {
      warn(msg);
    } else if (priority === 2) {
      fatal(msg);
    }
  }

  function debug(msg) {
    if (logLevelInt < 1) {
      console.info(msg);
    }
  }

  function warn(msg) {
    if (logLevelInt < 2) {
      console.warn(msg);
    }
  }

  function fatal(msg) {
    console.error(msg);
    throw Error(msg);
  }
}

/**
 *
 * @param {string} filePath
 */
function isLicense(filePath) {
  const fileName = path.basename(filePath);
  return ["license", "license.md", "license.txt"].some(
    (candidate) => fileName.toLowerCase() === candidate
  );
}

function isPackageJson(filePath) {
  return "package.json" === filePath.toLowerCase();
}
