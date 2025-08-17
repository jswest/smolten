import { writeFileSync } from "fs";

import { PATHS, REQUIRED_PACKAGES, getPlatformPaths } from "./constants.js";
import { handleError } from "./error-handler.js";
import PythonEnvironment from "./python-env.js";
import userOutput from "./user-output.js";
import { runCommand } from "./utils.js";

class PythonSetup {
  constructor() {
    this.env = new PythonEnvironment();
    const paths = getPlatformPaths();
    this.isWindows = paths.isWindows;
  }

  async setup() {
    userOutput.progress("Setting up Python environment...");

    try {
      const pythonCheck = await this.env.checkPythonInstalled();
      if (!pythonCheck.installed) {
        throw new Error(`Python setup failed: ${pythonCheck.error}`);
      }

      userOutput.success(`Python ${pythonCheck.fullVersion} detected`);

      await this.ensureRequirementsFile();

      if (!this.env.checkVenvExists()) {
        userOutput.progress("Creating virtual environment (.venv)...");
        await this.createVirtualEnvironment();
        userOutput.success("Virtual environment created");
      } else {
        userOutput.success("Virtual environment already exists");
      }

      userOutput.progress("Installing Python packages...");
      await this.installPackages();

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
      handleError(error, "Python setup");
      return false;
    }
  }

  async ensureRequirementsFile() {
    if (!this.env.checkRequirementsExists()) {
      const requirements = REQUIRED_PACKAGES.map(pkg => {
        const versions = {
          smolagents: ">=0.1.0",
          pandas: ">=2.0.0",
          litellm: ">=1.0.0"
        };
        return `${pkg}${versions[pkg] || ""}`;
      }).join("\n") + "\n";
      
      writeFileSync(PATHS.REQUIREMENTS_PATH, requirements);
      userOutput.success("Created requirements.txt");
    }
  }

  async createVirtualEnvironment() {
    await runCommand(this.env.pythonCmd, ["-m", "venv", PATHS.VENV_PATH]);
  }

  async installPackages() {
    for (const pkg of REQUIRED_PACKAGES) {
      userOutput.info(`  Installing ${pkg}...`);
      await runCommand(this.env.venvPip, ["install", pkg]);
    }
    userOutput.success("All packages installed");
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
