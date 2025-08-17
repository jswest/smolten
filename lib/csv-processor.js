import { existsSync } from "fs";
import { dirname, basename, extname, join } from "path";

import { DEFAULTS, ERROR_CODES } from "./constants.js";
import { validatePaths, ensureDirectory } from "./utils.js";
import { SmoltenError } from "./error-handler.js";
import config from "./config.js";
import cliOutput from "./cli-output.js";
import logger from "./logger.js";
import { askYesNo, askQuestion } from "./prompt-utils.js";
import PythonHandler from "./python-handler.js";

class CSVProcessor {
  constructor() {
    this.config = config.getConfig();
    this.pythonHandler = new PythonHandler();
  }

  async processCSV(inputPath, outputPath, options = {}) {
    const {
      columns,
      ontology,
      skipOntology,
      tags = DEFAULTS.TAG_COUNT,
      sampleSize = DEFAULTS.SAMPLE_SIZE,
      additionalPrompt = "",
    } = options;

    logger.info("Starting CSV processing", {
      input: inputPath,
      output: outputPath,
      options,
      user: this.config.userName
    });

    // Validate paths
    try {
      validatePaths(inputPath, outputPath, ontology);
    } catch (error) {
      throw new SmoltenError(`Path validation failed: ${error.message}`, ERROR_CODES.FILE_NOT_FOUND);
    }

    // Check if output file already exists and warn user
    if (existsSync(outputPath)) {
      cliOutput.warning(`Hold up! There's already a file cooling at: ${outputPath}`);
      cliOutput.info("smolten is about to melt right over it...");
      cliOutput.newline();
      
      cliOutput.prompt(); // Clear any in-progress displays
      const shouldOverwrite = await askYesNo("🔥 Are you sure you want to overwrite this file?");
      
      if (!shouldOverwrite) {
        cliOutput.info("🛡️ Wise choice! smolten keeps your data safe.");
        cliOutput.info("💡 Try a different output path to avoid the heat.");
        throw new SmoltenError("Output file already exists and user chose not to overwrite");
      }
      
      cliOutput.info("🌶️ Alright, let's melt that old file into something better!");
    }

    let ontologyPath = ontology;

    // Step 1: Generate ontology (unless skipped or provided)
    if (!skipOntology && !ontologyPath) {
      cliOutput.moltenProgress("preparing the lava forge");
      
      // Generate ontology path in the same directory as the output file
      const outputDir = dirname(outputPath);
      const outputBasename = basename(outputPath, extname(outputPath));
      const timestamp = new Date().toISOString().slice(0, 10); // Just date, not full timestamp
      ontologyPath = join(outputDir, `${outputBasename}-ontology-${timestamp}.json`);
      
      // Ensure output directory exists
      ensureDirectory(outputDir);
      
      await this.pythonHandler.generateOntology(inputPath, ontologyPath, {
        columns,
        tagCount: tags,
        sampleSize,
        additionalPrompt,
        modelProvider: this.config.modelProvider,
        modelName: this.config.modelName,
        apiKey: this.config.apiKey,
        keyName: config.getApiKeyName(this.config.modelProvider)
      });
      
      // Ask user to review ontology
      cliOutput.prompt();
      const shouldReview = await askYesNo("Would you like to review the generated ontology?");
      
      if (shouldReview) {
        cliOutput.info(`🗂️ Your ontology gems are cooling at: ${ontologyPath}`);
        cliOutput.info("🔍 Take a peek, then we'll continue the magic...");
        
        cliOutput.prompt();
        await askQuestion("🌶️ Ready to melt some data? Press Enter to start tagging...");
      }
    } else if (!ontologyPath) {
      throw new SmoltenError("Either provide an ontology file or allow ontology generation");
    }

    // Validate ontology file exists
    if (!existsSync(ontologyPath)) {
      throw new SmoltenError(`Ontology file not found: ${ontologyPath}`, ERROR_CODES.FILE_NOT_FOUND);
    }

    // Step 2: Tag the CSV
    cliOutput.moltenProgress("drizzling tags like honey on your data");
    
    await this.pythonHandler.tagCSV(inputPath, ontologyPath, outputPath, {
      modelProvider: this.config.modelProvider,
      modelName: this.config.modelName,
      apiKey: this.config.apiKey,
      keyName: config.getApiKeyName(this.config.modelProvider)
    });

    cliOutput.moltenComplete("Tagging eruption complete! Your data has been beautifully molten-ized!");
    cliOutput.info(`✨ Your sparkly tagged CSV awaits at: ${outputPath}`);

    return {
      inputPath,
      outputPath,
      ontologyPath,
      success: true
    };
  }

  // Removed old process handling - now using PythonHandler
}

export default CSVProcessor;