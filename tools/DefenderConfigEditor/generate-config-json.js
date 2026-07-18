const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
const jsPath = path.join(projectRoot, "game-config.js");
const jsonPath = path.join(projectRoot, "game-config.json");

global.window = globalThis;
require(jsPath);

const config = globalThis.DEFENDER_CONFIG;
if (!config?.units?.wall || !config?.units?.player || !config?.units?.enemy) {
  throw new Error("game-config.js does not contain a valid Defender config");
}

const json = `${JSON.stringify(config, null, 2)}\n`;
const browserConfig = [
  "/* Generated from game-config.json by Defender Config Editor. */",
  "/* Edit with Defender-Config-Editor.exe to keep both files synchronized. */",
  `window.DEFENDER_CONFIG = ${JSON.stringify(config, null, 2)};`,
  ""
].join("\n");

fs.writeFileSync(jsonPath, json, "utf8");
fs.writeFileSync(jsPath, browserConfig, "utf8");
console.log(`Generated ${jsonPath}`);
console.log(`Updated ${jsPath}`);
