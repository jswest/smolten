import { spawn } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, "..");
const VENV_PATH = join(PROJECT_ROOT, ".venv");
const REQUIREMENTS_PATH = join(PROJECT_ROOT, "requirements.txt");

export class PythonEnvironment {
  constructor() {
    this.isWindows = process.platform === "win32";
    this.pythonCmd = this.isWindows ? "python" : "python3";
    this.venvPython = this.isWindows
      ? join(VENV_PATH, "Scripts", "python.exe")
      : join(VENV_PATH, "bin", "python");
    this.venvPip = this.isWindows
      ? join(VENV_PATH, "Scripts", "pip.exe")
      : join(VENV_PATH, "bin", "pip");
  }

  async checkPythonInstalled() {
    try {
      const version = await this.runCommand(this.pythonCmd, ["--version"]);
      const match = version.match(/Python (\d+)\.(\d+)/);

      if (!match) {
        return { installed: false, error: "Could not parse Python version" };
      }

      const major = parseInt(match[1]);
      const minor = parseInt(match[2]);

      if (major < 3 || (major === 3 && minor < 8)) {
        return {
          installed: false,
          error: `Python ${major}.${minor} found, but 3.8+ required`,
        };
      }

      return {
        installed: true,
        version: `${major}.${minor}`,
        fullVersion: version.trim(),
      };
    } catch (error) {
      return {
        installed: false,
        error: `Python not found: ${error.message}`,
      };
    }
  }

  checkVenvExists() {
    return existsSync(VENV_PATH);
  }

  checkRequirementsExists() {
    return existsSync(REQUIREMENTS_PATH);
  }

  async checkVenvActivated() {
    if (!this.checkVenvExists()) {
      return false;
    }

    try {
      await this.runCommand(this.venvPython, ["--version"]);
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkPackagesInstalled() {
    if (!this.checkVenvActivated()) {
      return { installed: false, missing: ["venv not activated"] };
    }

    try {
      const output = await this.runCommand(this.venvPip, [
        "list",
        "--format=freeze",
      ]);
      const installedPackages = output.toLowerCase();

      const requiredPackages = ["smolagents", "pandas", "litellm"];
      const missing = requiredPackages.filter(
        (pkg) => !installedPackages.includes(pkg.toLowerCase())
      );

      return {
        installed: missing.length === 0,
        missing: missing,
        packages: installedPackages.split("\n").filter((line) => line.trim()),
      };
    } catch (error) {
      return {
        installed: false,
        missing: ["Could not check packages"],
        error: error.message,
      };
    }
  }

  async getEnvironmentStatus() {
    logger.debug("Checking Python environment status");

    const pythonCheck = await this.checkPythonInstalled();
    if (!pythonCheck.installed) {
      return {
        ready: false,
        status: "python_missing",
        message: pythonCheck.error,
        details: { python: pythonCheck },
      };
    }

    const venvExists = this.checkVenvExists();
    if (!venvExists) {
      return {
        ready: false,
        status: "venv_missing",
        message: "Virtual environment not found",
        details: { python: pythonCheck, venv: false },
      };
    }

    const venvActive = await this.checkVenvActivated();
    if (!venvActive) {
      return {
        ready: false,
        status: "venv_broken",
        message: "Virtual environment exists but cannot be activated",
        details: { python: pythonCheck, venv: true, venvActive: false },
      };
    }

    const packagesCheck = await this.checkPackagesInstalled();
    if (!packagesCheck.installed) {
      return {
        ready: false,
        status: "packages_missing",
        message: `Missing packages: ${packagesCheck.missing.join(", ")}`,
        details: {
          python: pythonCheck,
          venv: true,
          venvActive: true,
          packages: packagesCheck,
        },
      };
    }

    return {
      ready: true,
      status: "ready",
      message: "Python environment ready",
      details: {
        python: pythonCheck,
        venv: true,
        venvActive: true,
        packages: packagesCheck,
      },
    };
  }

  runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: this.isWindows,
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      process.on("error", (error) => {
        reject(error);
      });
    });
  }
}

export default PythonEnvironment;
