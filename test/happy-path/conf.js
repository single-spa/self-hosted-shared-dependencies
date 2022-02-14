/**
 * @type {import('../../lib/self-hosted-shared-dependencies.js').BuildOpts}
 */
export default {
  clean: true,
  // skipPackagesAtUrl: 'https://unpkg.com/',
  generateDockerfile: true,
  // customSplit: '@',
  logLevel: "debug",
  registryFetchOptions: {
    username: "fake-username",
    password: "not-the-real-password",
  },
  packages: [
    {
      name: "react",
      include: ["umd/**"],
      versions: [">= 17"],
    },
    {
      name: "react-dom",
      include: ["umd/**"],
      versions: ["17.0.1"],
    },
  ],
};
