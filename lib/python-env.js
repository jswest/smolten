import { existsSync } from "fs";
import { PATHS, REQUIRED_PACKAGES, getPlatformPaths, VALIDATION, ERROR_CODES } from "./constants.js";
import { runCommand, validatePythonVersion } from "./utils.js";
import { PythonEnvironmentError } from "./error-handler.js";
import logger from "./logger.js";

export class PythonEnvironment {
  constructor() {
    const paths = getPlatformPaths();
    this.isWindows = paths.isWindows;
    this.pythonCmd = paths.pythonCmd;
    this.venvPython = paths.venvPython;
    this.venvPip = paths.venvPip;
  }

  async checkPythonInstalled() {
    try {
      const version = await runCommand(this.pythonCmd, ["--version"]);
      
      if (!validatePythonVersion(version)) {
        const match = version.match(/Python (\d+)\.(\d+)/);
        const versionStr = match ? `${match[1]}.${match[2]}` : "unknown";
        return {
          installed: false,
          error: `Python ${versionStr} found, but ${VALIDATION.MIN_PYTHON_VERSION.join(".")}+ required`,
        };
      }

      const match = version.match(/Python (\d+)\.(\d+)/);
      return {
        installed: true,
        version: `${match[1]}.${match[2]}`,
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
    return existsSync(PATHS.VENV_PATH);
  }

  checkRequirementsExists() {
    return existsSync(PATHS.REQUIREMENTS_PATH);
  }

  async checkVenvActivated() {
    if (!this.checkVenvExists()) {
      return false;
    }

    try {
      await runCommand(this.venvPython, ["--version"]);
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
      const output = await runCommand(this.venvPip, ["list", "--format=freeze"]);
      const installedPackagesSet = new Set(
        output.toLowerCase().split("\n")
          .map(line => line.split("==")[0].trim())
          .filter(name => name)
      );

      const missing = REQUIRED_PACKAGES.filter(
        pkg => !installedPackagesSet.has(pkg.toLowerCase())
      );

      return {
        installed: missing.length === 0,
        missing,
        packages: Array.from(installedPackagesSet),
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
        status: ERROR_CODES.PYTHON_MISSING,
        message: pythonCheck.error,
        details: { python: pythonCheck },
      };
    }

    const venvExists = this.checkVenvExists();
    if (!venvExists) {
      return {
        ready: false,
        status: ERROR_CODES.VENV_MISSING,
        message: "Virtual environment not found",
        details: { python: pythonCheck, venv: false },
      };
    }

    const venvActive = await this.checkVenvActivated();
    if (!venvActive) {
      return {
        ready: false,
        status: ERROR_CODES.VENV_BROKEN,
        message: "Virtual environment exists but cannot be activated",
        details: { python: pythonCheck, venv: true, venvActive: false },
      };
    }

    const packagesCheck = await this.checkPackagesInstalled();
    if (!packagesCheck.installed) {
      return {
        ready: false,
        status: ERROR_CODES.PACKAGES_MISSING,
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

  // Removed runCommand - now using shared utility
}

export default PythonEnvironment;
