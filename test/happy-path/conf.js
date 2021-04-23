/**
 * @type {import('../../lib/self-hosted-shared-dependencies.js').BuildOpts}
 */
export default {
  clean: true,
  // skipPackagesAtUrl: 'https://unpkg.com/',
  generateDockerfile: true,
  logLevel: "warn",
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
