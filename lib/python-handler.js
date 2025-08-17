import { spawn } from "child_process";
import { join } from "path";
import { PATHS, getPlatformPaths, ERROR_CODES } from "./constants.js";
import { SmoltenError } from "./error-handler.js";
import { formatTokenCount } from "./utils.js";
import cliOutput from "./cli-output.js";
import logger from "./logger.js";

class PythonHandler {
  constructor() {
    const paths = getPlatformPaths();
    this.venvPython = paths.venvPython;
    this.isWindows = paths.isWindows;
  }

  async runAgent(args, operationName, config = {}) {
    return new Promise((resolve, reject) => {
      logger.info(`Starting ${operationName}`, { 
        command: this.venvPython,
        args: args.slice(0, 3) // Log first 3 args only for security
      });

      // Ensure any previous progress is completed before starting
      cliOutput.prompt();

      const childProcess = spawn(this.venvPython, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
        cwd: PATHS.PROJECT_ROOT,
        env: {
          ...process.env,
          // Suppress external logging
          PYTHONWARNINGS: "ignore",
          LITELLM_LOG: "ERROR",
          // Pass through configured API keys
          ...(config.apiKey && {
            SMOLTEN_API_KEY: config.apiKey,
            [config.keyName || ""]: config.apiKey
          })
        }
      });

      let stdout = "";
      let stderr = "";
      let currentOperation = operationName;

      // Handle stdout (should be minimal/none from our agents)
      childProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      // Handle stderr - this is where our structured progress comes from
      childProcess.stderr.on("data", (data) => {
        const output = data.toString();
        stderr += output;
        
        // Parse structured progress messages
        this.parseProgressOutput(output, currentOperation);
      });

      childProcess.on("close", (code) => {
        if (code === 0) {
          // Don't show completion message here - let Python handle it
          logger.info(`${operationName} completed successfully`);
          resolve(stdout.trim());
        } else {
          const error = stderr || `Process exited with code ${code}`;
          cliOutput.error(`${operationName} failed: ${error}`);
          logger.error(`${operationName} failed`, { 
            code, 
            stderr: stderr.slice(-500),
            stdout: stdout.slice(-500)
          });
          reject(new SmoltenError(`${operationName} failed: ${error}`, ERROR_CODES.PROCESS_FAILED, { code, stderr, stdout }));
        }
      });

      childProcess.on("error", (error) => {
        cliOutput.error(`${operationName} process error: ${error.message}`);
        logger.error(`${operationName} process error`, { 
          error: error.message 
        });
        reject(new SmoltenError(`${operationName} process error: ${error.message}`, ERROR_CODES.PROCESS_FAILED));
      });
    });
  }

  parseProgressOutput(output, operation) {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Look for our structured progress messages
      if (line.includes('SMOLTEN_PROGRESS:')) {
        try {
          const jsonStr = line.split('SMOLTEN_PROGRESS:')[1].trim();
          const progress = JSON.parse(jsonStr);
          this.handleStructuredProgress(progress, operation);
        } catch (e) {
          // Log parsing errors for debugging but don't crash
          logger.debug(`Failed to parse progress message: ${line}`, { error: e.message });
        }
      }
      // Handle simple lava messages from Python
      else if (line.startsWith('🌋')) {
        const message = line.substring(2).trim();
        // Ensure we complete any existing progress before starting new
        cliOutput.moltenProgress(message);
      }
      // Handle completion messages
      else if (line.includes('eruption complete') || line.includes('complete!')) {
        // Let the process close handler show completion
      }
      // Log other stderr output for debugging (but filter out debug noise)
      else if (!line.includes('DEBUG:') && !line.includes('WARNING:') && line.trim()) {
        logger.debug(`Python stderr: ${line}`);
      }
    }
  }

  handleStructuredProgress(progress, operation) {
    const { type, message, percentage, emoji } = progress;
    
    // Format token counts in messages for better readability
    let formattedMessage = message;
    if (message && message.includes('tokens')) {
      formattedMessage = message.replace(/(\d+\.?\d*k?) (input|output) tokens/g, (match, count, type) => {
        return `${count} ${type} tokens`;
      });
    }
    
    switch (type) {
      case 'progress':
        // Use moltenProgress for streaming token updates to get in-place updates
        cliOutput.moltenProgress(formattedMessage, emoji || '🔥');
        break;
      case 'status':
        cliOutput.moltenProgress(formattedMessage, emoji || '🌋');
        break;
      case 'complete':
        cliOutput.moltenComplete(formattedMessage, emoji || '💎');
        break;
      case 'error':
        cliOutput.error(formattedMessage, emoji || '❌');
        break;
      default:
        cliOutput.moltenProgress(formattedMessage, emoji || '🌋');
    }
  }

  // Utility to run ontology generation
  async generateOntology(csvPath, ontologyPath, options = {}) {
    const {
      columns,
      tagCount = 10,
      sampleSize = 1000,
      additionalPrompt = "",
      modelProvider,
      modelName,
      apiKey,
      keyName
    } = options;

    const args = [
      join(PATHS.AGENTS_DIR, "ontologicker.py"),
      csvPath,
      ontologyPath,
      "--model", `${modelProvider}/${modelName}`,
      "--tag-count", tagCount.toString(),
      "--sample-size", sampleSize.toString(),
      "--additional-prompt", additionalPrompt
    ];

    if (columns && columns.length > 0) {
      args.push("--columns", columns.join(","));
    }

    return this.runAgent(args, "ontology generation", { apiKey, keyName });
  }

  // Utility to run CSV tagging
  async tagCSV(csvPath, ontologyPath, outputPath, options = {}) {
    const { modelProvider, modelName, apiKey, keyName } = options;

    const args = [
      join(PATHS.AGENTS_DIR, "tagger.py"),
      csvPath,
      ontologyPath,
      outputPath,
      "--model", modelName,
      "--provider", modelProvider,
    ];

    return this.runAgent(args, "CSV tagging", { apiKey, keyName });
  }
}

export default PythonHandler;