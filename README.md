# self-hosted-shared-dependencies

A tool for self hosting shared dependencies from npm

## Motivation

To share dependencies between microfrontends with SystemJS, you need a URL reachable by the browser for each shared dependency. Using popular CDNs such as jsdelivr.net, unpkg.com, and cdnjs.com is the easiest way to do this, but requires that you rely on a third party service. For some organizations, self-hosting the dependencies is required for security or other reasons.

The self-hosted-shared-dependencies project generates a directory of static frontend assets that can be hosted on a server or CDN of your choosing. The assets are generated upfront, so that the server does not have to do anything more than serve static files. An advantage of generating all files upfront is improved performance, availability, and scalability, since global object stores (such as AWS S3, Digital Ocean Spaces, or GCP Storage) generally are really good at that.

## Comparison to other tools

Bundlers like webpack, rollup, etc do not produce separate files for each dependency, by default. Additionally, they generally do not create separate files for different versions of dependencies.

Tools like jspm, snowpack, and vite can do this but often convert the packages to ESM format which is not usable by SystemJS.

[esm-bundle](https://github.com/esm-bundle) libraries produce SystemJS versions of npm packages, but there are only a few dozen libraries available.

Using a forked version of unpkg generally requires running a live server in production which makes calls to the npm registry as it receives requests from users, which is nice because you don't have to specify which packages you're using but also potentially worse for availability, performance, and scalability.

## Installation

```sh
npm install --save-dev self-hosted-shared-dependencies

yarn add --dev self-hosted-shared-dependencies

pnpm install --save-dev self-hosted-shared-dependencies

# Global installation (optional)

npm install --global self-hosted-shared-dependencies

yarn global add self-hosted-shared-dependencies

pnpm install --global self-hosted-shared-dependencies
```

## Requirements

self-hosted-shared-dependencies requires NodeJS@>=14 (uses ES modules and nullish coalescing operator)

## Usage

It's recommended to run self-hosted-shared-dependencies during the CI/CD build and deploy process of a repository called `shared-dependencies` within your organization. It will generate a static directory of frontend assets, and optionally a Dockerfile for self-hosting the frontend assets. The easiest way to accomplish this is often to add to your npm-scripts in your project's package.json:

```json
{
  "scripts": {
    "build-shared-deps": "shared-deps build shared-deps.conf.mjs"
  }
}
```

Then create a shared-deps.conf.mjs file:

### Config File

```js
// shared-deps.conf.mjs

/**
 * @type {import('self-hosted-shared-dependencies').BuildOpts}
 */
const config = {
  // Required, a list of npm package versions to include in the output directory
  packages: [
    {
      // Required. The name of the package to include
      name: "react",

      // Optional. A list of glob strings used to determine which files within
      // the package to include in the build. By default, all files are included.
      // See https://www.npmjs.com/package/micromatch for glob implementation
      // Note that package.json and LICENSE files are always included.
      include: ["umd/**"],

      // Optional. A list of glob strings used to determine which files within
      // the package to exclude from the build. By default, no files are excluded.
      // See https://www.npmjs.com/package/micromatch for glob implementation
      // Note that package.json and LICENSE files are always included.
      exclude: ["cjs/**"],

      // Required. A list of semver ranges that determine which versions of the
      // npm package should be included in the build.
      // See https://semver.npmjs.com/ for more details
      versions: [
        // When the version is a string, the package's include and exclude lists
        // are applied
        ">= 17",

        // When the version is an object, the version's include and exclude lists
        // take priority over the package's include and exclude lists
        {
          version: "16.14.0",
          include: ["umd/**", "cjs/**"],
        },
      ],
    },
  ],

  // Optional, defaults to "npm"
  // Change the name of the output directory where the static assets
  // will be placed. The outputDir is resolved relative to the CWD
  outputDir: "npm",

  // Optional, defaults to false
  // When true, the outputDir will be deleted at the beginning of the build
  clean: false,

  // Optional, defaults to false.
  // When true, a Dockerfile will be created in your static directory.
  // The Dockerfile uses nginx:latest as its base image
  generateDockerfile: false,

  // Optional, defaults to building all packages (no skipping)
  // When provided, this allows you to do incremental builds where
  // the build first calls out to your live server hosting your
  // shared dependencies to decide whether it needs to rebuild
  // the package. This is a performance optimization that makes the
  // build faster. For each package version, it will check
  // <skipPackagesAtUrl>/<packageName>@<version>/package.json to
  // see if it needs to build the package version or not
  skipPackagesAtUrl: "https://cdn.example.com/npm/",

  // Optional, defaults to "debug". Must be one of "debug", "warn", or "fatal"
  // This changes the verbosity of the stdout logging
  logLevel: "warn",
};

export default config;
```

Now you can run `npm run build` to generate the output directory.

Once you have the output directory, you can run `npx http-server npm` to start up a server that hosts the files. In CI processes, usually the output directory is uploaded to a live server as part of a deployment.

## Example output

Here's an example showing the file structure created by running `shared-deps build`

```sh
npm
npm/Dockerfile
npm/react@17.0.0
npm/react@17.0.0/LICENSE
npm/react@17.0.0/umd
npm/react@17.0.0/umd/react.production.min.js
npm/react@17.0.0/umd/react.development.js
npm/react@17.0.0/umd/react.profiling.min.js
npm/react@17.0.0/package.json
npm/react@17.0.1
npm/react@17.0.1/LICENSE
npm/react@17.0.1/umd
npm/react@17.0.1/umd/react.production.min.js
npm/react@17.0.1/umd/react.development.js
npm/react@17.0.1/umd/react.profiling.min.js
npm/react@17.0.1/package.json
npm/react@17.0.2
npm/react@17.0.2/LICENSE
npm/react@17.0.2/umd
npm/react@17.0.2/umd/react.production.min.js
npm/react@17.0.2/umd/react.development.js
npm/react@17.0.2/umd/react.profiling.min.js
npm/react@17.0.2/package.json
npm/react-dom@17.0.1
npm/react-dom@17.0.1/LICENSE
npm/react-dom@17.0.1/umd
npm/react-dom@17.0.1/umd/react-dom-server.browser.development.js
npm/react-dom@17.0.1/umd/react-dom.production.min.js
npm/react-dom@17.0.1/umd/react-dom.profiling.min.js
npm/react-dom@17.0.1/umd/react-dom-test-utils.production.min.js
npm/react-dom@17.0.1/umd/react-dom.development.js
npm/react-dom@17.0.1/umd/react-dom-server.browser.production.min.js
npm/react-dom@17.0.1/umd/react-dom-test-utils.development.js
npm/react-dom@17.0.1/package.json
```

## Docker

To host the output directory in a server running in a docker container, set the `generateDockerfile` option to `true`. That will produce an `npm/Dockerfile` file which you can use to create an image and run containers.

To test the docker container, run the following:

```sh
# assumes that your outputDir is set to "npm"

# build the image
docker build npm -t shared-deps

# run the image as a container, exposing it to your host computer's port 8080
docker run --name shared-deps -d -p 8080:80 shared-deps

# verify that you can retrieve one of the built files
curl http://localhost:8080/npm/react@17.0.0/umd/react.production.min.js

# shut down the container
docker stop shared-deps
```

## CLI

The CLI has the following flags:

```sh
shared-deps build shared-deps.conf.mjs --clean --outputDir npm --generateDockerfile --skipPackagesAtUrl https://cdn.example.com/npm/ --logLevel warn
```

## Javascript API

You may also use this project via javascript. Note that it is published as an ES module so you must use `import` or `import()` to use it, you cannot use `require()`.

```js
import { build } from "self-hosted-shared-dependencies";

build({
  // This object is the same as the object exported from the Config File above
  packages: [
    {
      name: "react",
      include: ["umd/**"],
      exclude: ["cjs/**"],
      versions: [
        ">= 17",
        {
          version: "16.14.0",
          include: ["umd/**", "cjs/**"],
        },
      ],
    },
  ],
  outputDir: "npm",
  clean: false,
  generateDockerfile: false,
  skipPackagesAtUrl: "https://cdn.example.com/npm/",
  logLevel: "warn",
}).then(
  () => {
    console.log("Finished!");
  },
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
```
