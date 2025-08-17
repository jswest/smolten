import { readFileSync } from "fs";
import { join } from "path";
import { Command } from "commander";

import { PATHS, DEFAULTS } from "./constants.js";
import { validateRequired, handleError, SmoltenError } from "./error-handler.js";
import { parseModelId, parseColumns } from "./utils.js";
import logger from "./logger.js";
import PythonEnvironment from "./python-env.js";
import PythonSetup from "./setup-python.js";
import cliOutput from "./cli-output.js";
import config from "./config.js";
import CSVProcessor from "./csv-processor.js";
import { askYesNo } from "./prompt-utils.js";

const packageJson = JSON.parse(
  readFileSync(join(PATHS.PROJECT_ROOT, "package.json"), "utf8")
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

    cliOutput.info("Python Environment Status", "🔍");
    cliOutput.newline();
    
    if (status.ready) {
      cliOutput.complete("Environment ready", "✅");
      cliOutput.info("Ready to tag CSV files!", "🚀");
    } else {
      cliOutput.error(status.message);
      cliOutput.info("To fix this, run: smolten setup", "💡");
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
  .option("-t, --tag-count <number>", "Override default tag count")
  .option(
    "--skip-ontology",
    "Skip ontology generation and use existing ontology"
  )
  .option("--sample-size <number>", "Override default sample size")
  .option("--auto-setup", "Automatically set up Python environment if needed")
  .option(
    "--log-level <level>",
    "Log level (error, warn, info, debug)",
    "error"
  )
  .option(
    "--additional-prompt <prompt>",
    "Any additional information the ontologicker should use when creating the ontology.",
    ""
  )
  .action(async (input, output, options) => {
    logger.level = options.logLevel;

    // Check configuration first
    const configValidation = config.validateConfig();
    if (!configValidation.valid) {
      cliOutput.error(configValidation.error);
      process.exit(1);
    }

    const userConfig = config.getConfig();

    if (!input || !output) {
      cliOutput.error("Both input and output file paths are required");
      logger.error("Both input and output file paths are required");
      process.exit(1);
    }

    // Check Python environment before proceeding
    const pythonEnv = new PythonEnvironment();
    const envStatus = await pythonEnv.getEnvironmentStatus();

    if (!envStatus.ready) {
      if (options.autoSetup) {
        cliOutput.moltenProgress("auto-setting up Python environment");
        const setup = new PythonSetup();
        const success = await setup.setup();

        if (!success) {
          cliOutput.error("Auto-setup failed. Try: smolten setup");
          process.exit(1);
        }
      } else {
        cliOutput.warning("Python environment setup required");
        cliOutput.info("This will create a Python virtual environment and install packages");
        cliOutput.newline();

        cliOutput.prompt();
        const shouldSetup = await askYesNo("Setup now?");

        if (shouldSetup) {
          const setup = new PythonSetup();
          const success = await setup.setup();

          if (!success) {
            cliOutput.error("Setup failed. You can try again with: smolten setup");
            process.exit(1);
          }
        } else {
          cliOutput.info("Setup skipped. To set up later, run: smolten setup", "💡");
          cliOutput.info("To check environment status, run: smolten check", "💡");
          process.exit(1);
        }
      }
    }

    const columns = parseColumns(options.columns);

    // Use configured model or override
    let provider, model;
    if (options.model) {
      try {
        const parsed = parseModelId(options.model);
        provider = parsed.provider;
        model = parsed.model;
      } catch (error) {
        handleError(error, "Model parsing");
        process.exit(1);
      }
    } else {
      provider = userConfig.modelProvider;
      model = userConfig.modelName;
    }

    const processingConfig = {
      input,
      output,
      columns,
      ontology: options.ontology,
      model: {
        provider,
        name: model,
      },
      tags: parseInt(options.tagCount || userConfig.defaultTagCount || DEFAULTS.TAG_COUNT),
      skipOntology: options.skipOntology,
      sampleSize: parseInt(options.sampleSize || userConfig.defaultSampleSize || DEFAULTS.SAMPLE_SIZE),
    };

    try {
      // Log after all user interactions are complete
      logger.info("Starting smolten CSV tagging process", {
        input,
        output,
        options,
        user: userConfig.userName,
      });
      logger.info("Configuration validated", processingConfig);

      const processor = new CSVProcessor();

      const result = await processor.processCSV(input, output, {
        columns,
        ontology: options.ontology,
        skipOntology: options.skipOntology,
        tags: processingConfig.tags,
        sampleSize: processingConfig.sampleSize,
        additionalPrompt: options.additionalPrompt,
      });

      cliOutput.newline();
      cliOutput.complete("CSV processing completed successfully!", "🎆");
      cliOutput.info(`Input: ${result.inputPath}`, "📄");
      cliOutput.info(`Output: ${result.outputPath}`, "✨");
      cliOutput.info(`Ontology: ${result.ontologyPath}`, "💎");
    } catch (error) {
      handleError(error, "CSV processing");
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
        cliOutput.warning("Smolten is not configured yet");
        cliOutput.info("Run 'smolten config' to set up your preferences", "💡");
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
  cliOutput.error("Invalid command. See --help for available commands");
  logger.error("Invalid command. See --help for available commands");
  process.exit(1);
});

export default program;
