import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { spawn } from "child_process";
import { PATHS, getPlatformPaths, VALIDATION, ERROR_CODES, DEFAULTS } from "./constants.js";
import { SmoltenError } from "./error-handler.js";
import logger from "./logger.js";

// Path utilities
export function validatePaths(inputPath, outputPath, ontologyPath = null) {
  const checks = {
    input: existsSync(inputPath),
    outputDir: existsSync(dirname(outputPath)),
    ontology: ontologyPath ? existsSync(ontologyPath) : true,
  };
  
  if (!checks.input) {
    throw new SmoltenError(`Input file not found: ${inputPath}`, ERROR_CODES.FILE_NOT_FOUND);
  }
  
  return checks;
}

export function ensureDirectory(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    logger.info("Created directory", { path: dirPath });
  }
}

// Format utilities
export function formatTokenCount(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return `${count}`;
}

export function formatModelId(provider, model) {
  if (!provider || !model) {
    throw new SmoltenError("Both provider and model are required");
  }
  return `${provider}/${model}`;
}

export function parseModelId(modelId) {
  const parts = modelId.split("/");
  if (parts.length !== 2) {
    throw new SmoltenError(`Model must be in format "provider/model", got: ${modelId}`);
  }
  return { provider: parts[0], model: parts[1] };
}

// Validation utilities
export function validateTagCount(count) {
  const num = parseInt(count);
  return num >= VALIDATION.MIN_TAG_COUNT && num <= DEFAULTS.MAX_TAGS;
}

export function validateSampleSize(size) {
  const num = parseInt(size);
  return num >= VALIDATION.MIN_SAMPLE_SIZE && num <= DEFAULTS.MAX_SAMPLE;
}

export function validatePythonVersion(versionString) {
  const match = versionString.match(/Python (\d+)\.(\d+)/);
  if (!match) return false;
  
  const major = parseInt(match[1]);
  const minor = parseInt(match[2]);
  const [minMajor, minMinor] = VALIDATION.MIN_PYTHON_VERSION;
  
  return major > minMajor || (major === minMajor && minor >= minMinor);
}

// Process utilities
export function runCommand(command, args = [], options = {}) {
  const { isWindows } = getPlatformPaths();
  
  return new Promise((resolve, reject) => {
    logger.debug("Running command", { command, args: args.slice(0, 3) }); // Log first 3 args only
    
    const childProcess = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: isWindows,
      cwd: PATHS.PROJECT_ROOT,
      ...options,
    });

    let stdout = "";
    let stderr = "";

    childProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const error = stderr || `Process exited with code ${code}`;
        reject(new SmoltenError(error, ERROR_CODES.PROCESS_FAILED, { code, stderr, stdout }));
      }
    });

    childProcess.on("error", (error) => {
      reject(new SmoltenError(`Process error: ${error.message}`, ERROR_CODES.PROCESS_FAILED));
    });
  });
}

// String utilities
export function normalizeTagName(tag) {
  return tag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function parseColumns(columnsString) {
  if (!columnsString) return null;
  return columnsString.split(",").map(col => col.trim()).filter(col => col.length > 0);
}