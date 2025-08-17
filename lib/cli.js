import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { Command } from "commander";

import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8")
);

const program = new Command();

program
  .name("smolten")
  .description("A smolagents-backed agent to auto-tag your CSV files")
  .version(packageJson.version)
  .argument("<input>", "Input CSV file path")
  .argument("<output>", "Output CSV file path")
  .option(
    "-c, --columns <columns>",
    "Comma-separated list of relevant columns to focus on"
  )
  .option("-o, --ontology <file>", "Existing ontology file path")
  .option(
    "-m, --model <provider/model>",
    'Model provider and name (e.g., "ollama/llama2" or "openai/gpt-4")',
    "ollama/gpt-oss:20b"
  )
  .option(
    "-t, --tag-count <number>",
    "Rough number of tags for ontology generation",
    "10"
  )
  .option(
    "--skip-ontology",
    "Skip ontology generation and use existing ontology"
  )
  .option(
    "--sample-size <number>",
    "Number of rows to sample for ontology generation",
    "1000"
  )
  .option("--log-level <level>", "Log level (error, warn, info, debug)", "info")
  .action(async (input, output, options) => {
    logger.level = options.logLevel;

    logger.info("Starting smolten CSV tagging process", {
      input,
      output,
      options,
    });

    if (!input || !output) {
      logger.error("Both input and output file paths are required");
      process.exit(1);
    }

    const columns = options.columns
      ? options.columns.split(",").map((col) => col.trim())
      : null;

    const [provider, model] = options.model.split("/");
    if (!provider || !model) {
      logger.error(
        'Model must be in format "provider/model" (e.g., "ollama/llama2")'
      );
      process.exit(1);
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
      tags: parseInt(options.tags),
      skipOntology: options.skipOntology,
      sampleSize: parseInt(options.sampleSize),
    };

    logger.info("Configuration validated", config);

    try {
      logger.info("Processing would start here with config:", config);
    } catch (error) {
      logger.error("Error during processing:", error);
      process.exit(1);
    }
  });

program.on("command:*", () => {
  logger.error("Invalid command. See --help for available commands.");
  process.exit(1);
});

export default program;
