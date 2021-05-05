import path from "path";
import { readFileSync } from "fs";

export default function buildFromPackageJSON() {
  console.log(path.resolve(process.cwd(), "package.json"));
  const packages = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
  );
  const packagesArr = Object.entries(packages.dependencies).map(
    ([name, version]) => {
      return {
        name,
        versions: [version],
      };
    }
  );
  return packagesArr;
}
