import { spawn } from "child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import PythonEnvironment from "./python-env.js";
import logger from "./logger.js";
import userOutput from "./user-output.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, "..");
const VENV_PATH = join(PROJECT_ROOT, ".venv");
const REQUIREMENTS_PATH = join(PROJECT_ROOT, "requirements.txt");

class PythonSetup {
  constructor() {
    this.env = new PythonEnvironment();
    this.isWindows = process.platform === "win32";
  }

  async setup() {
    userOutput.progress("Setting up Python environment...");

    try {
      // Check Python installation
      const pythonCheck = await this.env.checkPythonInstalled();
      if (!pythonCheck.installed) {
        throw new Error(`Python setup failed: ${pythonCheck.error}`);
      }

      userOutput.success(`Python ${pythonCheck.fullVersion} detected`);

      // Create requirements.txt if it doesn't exist
      await this.ensureRequirementsFile();

      // Create virtual environment
      if (!this.env.checkVenvExists()) {
        userOutput.progress("Creating virtual environment (.venv)...");
        await this.createVirtualEnvironment();
        userOutput.success("Virtual environment created");
      } else {
        userOutput.success("Virtual environment already exists");
      }

      // Install packages
      userOutput.progress("Installing Python packages...");
      await this.installPackages();

      // Verify installation
      const status = await this.env.getEnvironmentStatus();
      if (!status.ready) {
        throw new Error(`Setup verification failed: ${status.message}`);
      }

      userOutput.success("Setup complete!");
      userOutput.newline();
      userOutput.info(
        "Python environment ready. You can now use smolten to tag CSV files."
      );

      return true;
    } catch (error) {
      userOutput.error(`Setup failed: ${error.message}`);
      logger.error("Python setup failed", { error: error.message });
      return false;
    }
  }

  async ensureRequirementsFile() {
    if (!this.env.checkRequirementsExists()) {
      const requirements = `smolagents>=0.1.0
pandas>=2.0.0
litellm>=1.0.0
`;
      writeFileSync(REQUIREMENTS_PATH, requirements);
      userOutput.success("Created requirements.txt");
    }
  }

  async createVirtualEnvironment() {
    await this.runCommand(this.env.pythonCmd, ["-m", "venv", VENV_PATH]);
  }

  async installPackages() {
    const packages = ["smolagents", "pandas", "litellm"];

    for (const pkg of packages) {
      userOutput.info(`  Installing ${pkg}...`);
      await this.runCommand(this.env.venvPip, ["install", pkg]);
    }
    userOutput.success("All packages installed");
  }

  runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      logger.debug(`Running command: ${command} ${args.join(" ")}`);

      const process = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: this.isWindows,
        cwd: PROJECT_ROOT,
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
          const error = stderr || `Process exited with code ${code}`;
          logger.error(`Command failed: ${command} ${args.join(" ")}`, {
            code,
            stderr,
            stdout,
          });
          reject(new Error(error));
        }
      });

      process.on("error", (error) => {
        logger.error(`Command error: ${command} ${args.join(" ")}`, {
          error: error.message,
        });
        reject(error);
      });
    });
  }
}

async function main() {
  const setup = new PythonSetup();
  const success = await setup.setup();
  process.exit(success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default PythonSetup;
