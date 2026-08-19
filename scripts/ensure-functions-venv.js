/**
 * Firebase's Python Functions emulator needs functions/venv on Windows.
 * Creates it (Python 3.12) and installs requirements if missing.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const venvPython = process.platform === "win32"
  ? path.join(root, "functions", "venv", "Scripts", "python.exe")
  : path.join(root, "functions", "venv", "bin", "python");
const requirements = path.join(root, "functions", "requirements.txt");
const activateBat = path.join(root, "functions", "venv", "Scripts", "activate.bat");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: root,
    shell: false
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

if (fs.existsSync(venvPython) && (process.platform !== "win32" || fs.existsSync(activateBat))) {
  process.exit(0);
}

console.log("Setting up Python 3.12 venv for Cloud Functions...");

const created = spawnSync("py", ["-3.12", "-m", "venv", path.join("functions", "venv")], {
  stdio: "inherit",
  cwd: root,
  shell: false
});
if (created.status !== 0) {
  run("python", ["-m", "venv", path.join("functions", "venv")]);
}

run(venvPython, ["-m", "pip", "install", "-q", "-r", requirements]);
console.log("Functions venv ready.");
