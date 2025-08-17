import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path constants
export const PATHS = {
  PROJECT_ROOT: join(__dirname, ".."),
  AGENTS_DIR: join(__dirname, "..", "agents"),
  LOGS_DIR: join(__dirname, "..", "logs"),
  VENV_PATH: join(__dirname, "..", ".venv"),
  CONFIG_PATH: join(__dirname, "..", ".env"),
  REQUIREMENTS_PATH: join(__dirname, "..", "requirements.txt"),
};

// Platform-specific paths
export const getPlatformPaths = () => {
  const isWindows = process.platform === "win32";
  return {
    isWindows,
    pythonCmd: isWindows ? "python" : "python3",
    venvPython: isWindows
      ? join(PATHS.VENV_PATH, "Scripts", "python.exe")
      : join(PATHS.VENV_PATH, "bin", "python"),
    venvPip: isWindows
      ? join(PATHS.VENV_PATH, "Scripts", "pip.exe")
      : join(PATHS.VENV_PATH, "bin", "pip"),
  };
};

// Configuration constants
export const DEFAULTS = {
  TAG_COUNT: 10,
  SAMPLE_SIZE: 1000,
  MAX_TAGS: 50,
  MAX_SAMPLE: 10000,
  LOG_LEVEL: "error",
};

// Required packages for Python environment
export const REQUIRED_PACKAGES = ["smolagents", "pandas", "litellm"];

// Supported model providers
export const SUPPORTED_PROVIDERS = ["ollama", "openai", "anthropic", "huggingface"];

// Provider configuration
export const PROVIDER_CONFIG = {
  ollama: {
    needsApiKey: false,
    examples: "llama2, mistral, codellama, gpt-oss:20b",
    defaultApiBase: "http://localhost:11434/v1",
  },
  openai: {
    needsApiKey: true,
    keyName: "OPENAI_API_KEY",
    examples: "gpt-4, gpt-3.5-turbo, gpt-4o",
    defaultApiBase: "https://api.openai.com/v1",
  },
  anthropic: {
    needsApiKey: true,
    keyName: "ANTHROPIC_API_KEY",
    examples: "claude-3-5-sonnet-20241022, claude-3-opus-20240229",
    defaultApiBase: "https://api.anthropic.com",
  },
  huggingface: {
    needsApiKey: true,
    keyName: "HUGGINGFACE_API_KEY",
    examples: "meta-llama/Llama-2-7b-chat-hf, mistralai/Mistral-7B-Instruct-v0.1",
    defaultApiBase: "https://api-inference.huggingface.co",
  },
};

// Validation constants
export const VALIDATION = {
  MIN_PYTHON_VERSION: [3, 8],
  MIN_TAG_COUNT: 1,
  MIN_SAMPLE_SIZE: 1,
};

// Error codes
export const ERROR_CODES = {
  CONFIG_INVALID: "CONFIG_INVALID",
  PYTHON_MISSING: "PYTHON_MISSING",
  VENV_MISSING: "VENV_MISSING",
  VENV_BROKEN: "VENV_BROKEN",
  PACKAGES_MISSING: "PACKAGES_MISSING",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  PROCESS_FAILED: "PROCESS_FAILED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
};