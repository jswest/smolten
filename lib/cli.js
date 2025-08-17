import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { Command } from "commander";

import logger from "./logger.js";
import PythonEnvironment from "./python-env.js";
import PythonSetup from "./setup-python.js";
import userOutput from "./user-output.js";
import config from "./config.js";
import { askYesNo } from "./prompt-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8")
);

const program = new Command();

program
  .name("smolten")
  .description("A smolagents-backed agent to auto-tag your CSV files")
  .version(packageJson.version);

// Config subcommand
program
  .command("config")
  .description("Configure smolten settings")
  .option("--show", "Show current configuration")
  .option("--reset", "Reset configuration")
  .action(async (options) => {
    if (options.show) {
      config.showConfig();
    } else if (options.reset) {
      const success = await config.resetConfig();
      process.exit(success ? 0 : 1);
    } else {
      const success = await config.runConfigWizard();
      process.exit(success ? 0 : 1);
    }
  });

// Setup subcommand
program
  .command("setup")
  .description("Set up Python environment for smolagents")
  .action(async () => {
    const setup = new PythonSetup();
    const success = await setup.setup();
    process.exit(success ? 0 : 1);
  });

// Check subcommand
program
  .command("check")
  .description("Check Python environment status")
  .action(async () => {
    const env = new PythonEnvironment();
    const status = await env.getEnvironmentStatus();

    userOutput.section("Python Environment Status");
    userOutput.newline();
    userOutput.status(status.ready, status.message, status.details);

    if (status.ready) {
      userOutput.newline();
      userOutput.info("Ready to tag CSV files!");
    } else {
      userOutput.newline();
      userOutput.info("To fix this, run:");
      userOutput.command("smolten setup");
    }

    process.exit(status.ready ? 0 : 1);
  });

// Tag subcommand (main functionality)
program
  .command("tag")
  .description("Tag a CSV file using smolagents")
  .argument("<input>", "Input CSV file path")
  .argument("<output>", "Output CSV file path")
  .option(
    "-c, --columns <columns>",
    "Comma-separated list of relevant columns to focus on"
  )
  .option("-o, --ontology <file>", "Existing ontology file path")
  .option(
    "-m, --model <provider/model>",
    'Override configured model (e.g., "ollama/llama2")'
  )
  .option(
    "-t, --tag-count <number>",
    "Override default tag count"
  )
  .option(
    "--skip-ontology",
    "Skip ontology generation and use existing ontology"
  )
  .option(
    "--sample-size <number>",
    "Override default sample size"
  )
  .option("--auto-setup", "Automatically set up Python environment if needed")
  .option("--log-level <level>", "Log level (error, warn, info, debug)", "info")
  .action(async (input, output, options) => {
    logger.level = options.logLevel;

    // Check configuration first
    const configValidation = config.validateConfig();
    if (!configValidation.valid) {
      userOutput.error(configValidation.error);
      process.exit(1);
    }

    const userConfig = config.getConfig();
    
    logger.info("Starting smolten CSV tagging process", {
      input,
      output,
      options,
      user: userConfig.userName
    });

    if (!input || !output) {
      userOutput.error("Both input and output file paths are required");
      logger.error("Both input and output file paths are required");
      process.exit(1);
    }

    // Check Python environment before proceeding
    const pythonEnv = new PythonEnvironment();
    const envStatus = await pythonEnv.getEnvironmentStatus();

    if (!envStatus.ready) {
      if (options.autoSetup) {
        userOutput.progress("Auto-setting up Python environment...");
        const setup = new PythonSetup();
        const success = await setup.setup();

        if (!success) {
          userOutput.error("Auto-setup failed. Try: smolten setup");
          process.exit(1);
        }
      } else {
        userOutput.warning(
          "Python environment setup required for smolagents backend."
        );
        userOutput.newline();
        userOutput.info("Would you like to set it up now? This will:");
        userOutput.list([
          "Create a Python virtual environment (.venv)",
          "Install required packages (smolagents, pandas, litellm)",
        ]);
        userOutput.newline();

        const shouldSetup = await askYesNo("Setup now?");

        if (shouldSetup) {
          const setup = new PythonSetup();
          const success = await setup.setup();

          if (!success) {
            userOutput.newline();
            userOutput.error(
              "Setup failed. You can try again with: smolten setup"
            );
            process.exit(1);
          }
        } else {
          userOutput.newline();
          userOutput.info("Setup skipped. To set up later, run: smolten setup");
          userOutput.info("To check environment status, run: smolten check");
          process.exit(1);
        }
      }
    }

    const columns = options.columns
      ? options.columns.split(",").map((col) => col.trim())
      : null;

    // Use configured model or override
    let provider, model;
    if (options.model) {
      [provider, model] = options.model.split("/");
      if (!provider || !model) {
        userOutput.error(
          'Model must be in format "provider/model" (e.g., "ollama/llama2")'
        );
        process.exit(1);
      }
    } else {
      provider = userConfig.modelProvider;
      model = userConfig.modelName;
    }

    const config = {
      input,
      output,
      columns,
      ontology: options.ontology,
      model: {
        provider,
        name: model,
      },
      tags: parseInt(options.tagCount || userConfig.defaultTagCount),
      skipOntology: options.skipOntology,
      sampleSize: parseInt(options.sampleSize || userConfig.defaultSampleSize),
    };

    logger.info("Configuration validated", config);

    try {
      userOutput.progress("Processing your CSV...");
      logger.info("Processing would start here with config:", config);
    } catch (error) {
      userOutput.error(`Processing failed: ${error.message}`);
      logger.error("Error during processing:", error);
      process.exit(1);
    }
  });

// Default to tag command for backward compatibility
program
  .argument("[input]", "Input CSV file path")
  .argument("[output]", "Output CSV file path")
  .action((input, output) => {
    if (input && output) {
      // Check if user is configured before redirecting
      if (!config.isConfigured()) {
        userOutput.warning("Smolten is not configured yet.");
        userOutput.info("Run 'smolten config' to set up your preferences.");
        process.exit(1);
      }
      
      // Redirect to tag command
      program.parse([
        "node",
        "smolten", 
        "tag",
        input,
        output,
        ...process.argv.slice(4),
      ]);
    } else {
      program.help();
    }
  });

program.on("command:*", () => {
  userOutput.error("Invalid command. See --help for available commands.");
  logger.error("Invalid command. See --help for available commands.");
  process.exit(1);
});

export default program;
