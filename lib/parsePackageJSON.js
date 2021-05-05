import path from "path";
import { readFileSync } from "fs";

export default function buildFromPackageJSON() {
  const packages = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
  );
  return Object.entries(packages.dependencies).map(([name, version]) => {
    return {
      name,
      versions: [version],
    };
  });
}
