import { existsSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import dotenv from "dotenv";
import { input, select, password, confirm } from "@inquirer/prompts";

import userOutput from "./user-output.js";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, "..");
const CONFIG_PATH = join(PROJECT_ROOT, ".env");

class Config {
  constructor() {
    this.config = {};
    this.loadConfig();
  }

  loadConfig() {
    if (existsSync(CONFIG_PATH)) {
      dotenv.config({ path: CONFIG_PATH });
      this.config = {
        userName: process.env.SMOLTEN_USER_NAME || "",
        modelProvider: process.env.SMOLTEN_MODEL_PROVIDER || "",
        modelName: process.env.SMOLTEN_MODEL_NAME || "",
        apiKey: process.env.SMOLTEN_API_KEY || "",
        defaultTagCount: parseInt(process.env.SMOLTEN_DEFAULT_TAG_COUNT) || 10,
        defaultSampleSize:
          parseInt(process.env.SMOLTEN_DEFAULT_SAMPLE_SIZE) || 1000,
      };
    }
  }

  isConfigured() {
    return (
      this.config.userName && this.config.modelProvider && this.config.modelName
    );
  }

  getProviderExamples(provider) {
    const examples = {
      ollama: "llama2, mistral, codellama, gpt-oss:20b",
      openai: "gpt-4, gpt-3.5-turbo, gpt-4o",
      anthropic: "claude-3-5-sonnet-20241022, claude-3-opus-20240229",
      huggingface:
        "meta-llama/Llama-2-7b-chat-hf, mistralai/Mistral-7B-Instruct-v0.1",
    };
    return examples[provider] || "";
  }

  needsApiKey(provider) {
    return ["openai", "anthropic", "huggingface"].includes(provider);
  }

  getApiKeyName(provider) {
    const keyNames = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      huggingface: "HUGGINGFACE_API_KEY",
    };
    return keyNames[provider];
  }

  async runConfigWizard() {
    userOutput.section("Smolten Configuration");
    userOutput.newline();
    userOutput.info(
      "Let's set up your smolten configuration. This is a one-time setup."
    );
    userOutput.newline();

    try {
      // Get user name
      const userName = await input({
        message: "What's your name?",
        default: this.config.userName,
        validate: (input) =>
          input.trim().length > 0 ? true : "Name is required",
      });

      // Get model provider
      const modelProvider = await select({
        message: "Which model provider would you like to use?",
        choices: [
          { name: "Ollama (Local models)", value: "ollama" },
          { name: "OpenAI", value: "openai" },
          { name: "Anthropic", value: "anthropic" },
          { name: "HuggingFace", value: "huggingface" },
        ],
        default: this.config.modelProvider || "ollama",
      });

      // Get model name from user
      const examples = this.getProviderExamples(modelProvider);
      const modelName = await input({
        message: `Enter the ${modelProvider} model name:`,
        default: this.config.modelName,
        validate: (input) =>
          input.trim().length > 0 ? true : "Model name is required",
      });

      if (examples) {
        userOutput.info(`Examples: ${examples}`);
      }

      // Get API key if needed
      let apiKey = this.config.apiKey;
      if (this.needsApiKey(modelProvider)) {
        const keyName = this.getApiKeyName(modelProvider);

        userOutput.newline();
        userOutput.info(`${modelProvider} requires an API key (${keyName}).`);

        const hasKey = await confirm({
          message: "Do you have an API key?",
          default: true,
        });

        if (hasKey) {
          apiKey = await password({
            message: `Enter your ${keyName}:`,
            mask: "*",
            validate: (input) =>
              input.trim().length > 0 ? true : "API key is required",
          });
        } else {
          userOutput.warning(
            `You'll need to get an API key from ${modelProvider} to use this provider.`
          );
          userOutput.info(
            "You can run 'smolten config' again once you have your API key."
          );
          return false;
        }
      }

      // Get default preferences
      userOutput.newline();
      userOutput.info(
        "Set your default preferences (you can override these per command):"
      );

      const defaultTagCount = await input({
        message: "Default number of tags for ontology generation:",
        default: this.config.defaultTagCount?.toString() || "10",
        validate: (input) => {
          const num = parseInt(input);
          return num > 0 && num <= 50 ? true : "Must be between 1 and 50";
        },
      });

      const defaultSampleSize = await input({
        message: "Default sample size for large CSV files:",
        default: this.config.defaultSampleSize?.toString() || "1000",
        validate: (input) => {
          const num = parseInt(input);
          return num > 0 && num <= 10000 ? true : "Must be between 1 and 10000";
        },
      });

      // Save configuration
      const configData = {
        SMOLTEN_USER_NAME: userName,
        SMOLTEN_MODEL_PROVIDER: modelProvider,
        SMOLTEN_MODEL_NAME: modelName,
        SMOLTEN_DEFAULT_TAG_COUNT: defaultTagCount,
        SMOLTEN_DEFAULT_SAMPLE_SIZE: defaultSampleSize,
      };

      // Add API key if provided
      if (apiKey) {
        configData.SMOLTEN_API_KEY = apiKey;

        // Also set the provider-specific env var
        const providerKeyName = this.getApiKeyName(modelProvider);
        if (providerKeyName) {
          configData[providerKeyName] = apiKey;
        }
      }

      this.saveConfig(configData);

      userOutput.newline();
      userOutput.success("Configuration saved successfully!");
      userOutput.newline();
      userOutput.info(
        "You can now use smolten commands without specifying model details."
      );
      userOutput.info("To reconfigure, run: smolten config");
      userOutput.info("To view current config, run: smolten config --show");

      return true;
    } catch (error) {
      if (error.name === "ExitPromptError") {
        userOutput.warning("Configuration cancelled.");
        return false;
      }
      throw error;
    }
  }

  saveConfig(configData) {
    const envContent = Object.entries(configData)
      .map(([key, value]) => `${key}="${value}"`)
      .join("\n");

    writeFileSync(CONFIG_PATH, envContent);
    logger.info("Configuration saved", { configPath: CONFIG_PATH });

    // Reload the config
    this.loadConfig();
  }

  showConfig() {
    if (!this.isConfigured()) {
      userOutput.warning(
        "No configuration found. Run 'smolten config' to set up."
      );
      return;
    }

    userOutput.section("Current Smolten Configuration");
    userOutput.newline();

    userOutput.info(`Name: ${this.config.userName}`);
    userOutput.info(`Model Provider: ${this.config.modelProvider}`);
    userOutput.info(`Model: ${this.config.modelName}`);
    userOutput.info(`Default Tag Count: ${this.config.defaultTagCount}`);
    userOutput.info(`Default Sample Size: ${this.config.defaultSampleSize}`);

    if (this.needsApiKey(this.config.modelProvider)) {
      const hasKey = this.config.apiKey ? "✓ Set" : "✗ Not set";
      userOutput.info(`API Key: ${hasKey}`);
    }

    userOutput.newline();
    userOutput.info(`Config file: ${CONFIG_PATH}`);
  }

  resetConfig() {
    if (existsSync(CONFIG_PATH)) {
      // Don't actually delete, just rename with timestamp
      const backupPath = `${CONFIG_PATH}.backup.${Date.now()}`;
      writeFileSync(backupPath, readFileSync(CONFIG_PATH));
      userOutput.info(`Previous config backed up to: ${backupPath}`);
    }

    this.config = {};
    return this.runConfigWizard();
  }

  getConfig() {
    return { ...this.config };
  }

  validateConfig() {
    if (!this.isConfigured()) {
      return {
        valid: false,
        error: "Configuration incomplete. Run 'smolten config' to set up.",
      };
    }

    if (this.needsApiKey(this.config.modelProvider) && !this.config.apiKey) {
      return {
        valid: false,
        error: `API key required for ${this.config.modelProvider}. Run 'smolten config' to add it.`,
      };
    }

    return { valid: true };
  }
}

export default new Config();
