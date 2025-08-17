import { spawn } from "child_process";
import { existsSync } from "fs";
import { join, dirname, basename, extname } from "path";

import { PATHS, getPlatformPaths, DEFAULTS } from "./constants.js";
import { validatePaths, ensureDirectory, formatTokenCount, parseColumns } from "./utils.js";
import { ERROR_CODES } from "./constants.js";
import { SmoltenError, handleError } from "./error-handler.js";
import config from "./config.js";
import userOutput from "./user-output.js";
import logger from "./logger.js";
import { askYesNo, askQuestion } from "./prompt-utils.js";

class CSVProcessor {
  constructor() {
    this.config = config.getConfig();
    const paths = getPlatformPaths();
    this.isWindows = paths.isWindows;
    this.venvPython = paths.venvPython;
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
      userOutput.warning(`⚠️ Hold up! There's already a file cooling at: ${outputPath}`);
      userOutput.info("🌋 smolten is about to melt right over it...");
      userOutput.newline();
      
      const shouldOverwrite = await askYesNo("🔥 Are you sure you want to overwrite this file?");
      
      if (!shouldOverwrite) {
        userOutput.newline();
        userOutput.info("🛡️ Wise choice! smolten keeps your data safe.");
        userOutput.info("💡 Try a different output path to avoid the heat.");
        throw new Error("Output file already exists and user chose not to overwrite");
      }
      
      userOutput.newline();
      userOutput.info("🌶️ Alright, let's melt that old file into something better!");
    }

    let ontologyPath = ontology;

    // Step 1: Generate ontology (unless skipped or provided)
    if (!skipOntology && !ontologyPath) {
      userOutput.progress("🌋 Warming up the lava forge to craft your ontology...");
      
      // Generate ontology path in the same directory as the output file
      const outputDir = dirname(outputPath);
      const outputBasename = basename(outputPath, extname(outputPath));
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      ontologyPath = join(outputDir, `${outputBasename}-ontology-${timestamp}.json`);
      
      // Ensure output directory exists
      ensureDirectory(outputDir);
      
      await this.generateOntology(inputPath, ontologyPath, {
        columns,
        tagCount: tags,
        sampleSize,
        additionalPrompt,
      });

      userOutput.success("💎 Ontology gems have been forged in the molten depths!");
      
      // Ask user to review ontology
      const shouldReview = await askYesNo("Would you like to review the generated ontology?");
      
      if (shouldReview) {
        userOutput.info(`🗂️ Your shiny ontology gems are cooling at: ${ontologyPath}`);
        userOutput.info("🔍 Take a peek at the molten masterpiece, then we'll continue the magic...");
        
        // Wait for user to confirm they've reviewed
        await askQuestion("🌶️  Ready to melt some data? Press Enter to start tagging...");
      }
    } else if (!ontologyPath) {
      throw new Error("Either provide an ontology file or allow ontology generation");
    }

    // Validate ontology file exists
    if (!existsSync(ontologyPath)) {
      throw new SmoltenError(`Ontology file not found: ${ontologyPath}`, ERROR_CODES.FILE_NOT_FOUND);
    }

    // Step 2: Tag the CSV
    userOutput.progress("🍯 Time to drizzle tags like honey on your data...");
    
    await this.tagCSV(inputPath, ontologyPath, outputPath, {
      columns
    });

    userOutput.success("🌋 Tagging eruption complete! Your data has been beautifully molten-ized!");
    userOutput.info(`✨ Your sparkly tagged CSV awaits at: ${outputPath}`);

    return {
      inputPath,
      outputPath,
      ontologyPath,
      success: true
    };
  }

  async generateOntology(csvPath, ontologyPath, options = {}) {
    const {
      columns,
      tagCount = 10,
      sampleSize = 1000,
      additionalPrompt = "",
    } = options;

    const args = [
      join(PATHS.AGENTS_DIR, "ontologicker.py"),
      csvPath,
      ontologyPath,
      "--model", `${this.config.modelProvider}/${this.config.modelName}`,
      "--tag-count", tagCount.toString(),
      "--sample-size", sampleSize.toString(),
      "--additional-prompt", additionalPrompt
    ];

    if (columns && columns.length > 0) {
      args.push("--columns", columns.join(","));
    }

    return this.runPythonAgent(args, "ontology generation");
  }

  async tagCSV(csvPath, ontologyPath, outputPath, options = {}) {
    const { columns } = options;

    const args = [
      join(PATHS.AGENTS_DIR, "tagger.py"),
      csvPath,
      ontologyPath,
      outputPath,
      "--model", this.config.modelName,
      "--provider", this.config.modelProvider,
    ];

    return this.runPythonAgent(args, "CSV tagging");
  }

  runPythonAgent(args, operationName) {
    return new Promise((resolve, reject) => {
      logger.info(`Starting ${operationName}`, { 
        command: this.venvPython,
        args: args.map(arg => arg.includes(PATHS.PROJECT_ROOT) ? `.../${arg.split('/').pop()}` : arg)
      });

      const childProcess = spawn(this.venvPython, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
        cwd: PATHS.PROJECT_ROOT,
        env: {
          ...process.env,
          // Pass through configured API keys
          ...(this.config.apiKey && {
            SMOLTEN_API_KEY: this.config.apiKey,
            [config.getApiKeyName(this.config.modelProvider) || ""]: this.config.apiKey
          })
        }
      });

      let stdout = "";
      let stderr = "";

      childProcess.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;
        
        // Show all stdout output (if any)
        const lines = output.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          console.log(`[STDOUT] ${line}`);
        });
      });

      // Token counting for streaming responses
      let tokenCount = 0;
      let isStreamingTokens = false;
      
      childProcess.stderr.on("data", (data) => {
        const output = data.toString();
        stderr += output;
        
        // Handle Python output properly to preserve in-place updates
        const chunks = output.split('\n');
        
        chunks.forEach((chunk, index) => {
          // Skip empty chunks
          if (!chunk.trim() && index === chunks.length - 1) return;
          
          // Check if this is an in-place update (starts with \r or contains progress indicators)
          const isInPlaceUpdate = chunk.startsWith('\r') || 
                                  chunk.includes('Progress:') ||
                                  chunk.includes('Tokens received:');
          
          if (isInPlaceUpdate) {
            // Use process.stdout.write to preserve in-place behavior
            process.stdout.write(chunk);
            if (index < chunks.length - 1) {
              process.stdout.write('\n');
            }
          } else if (chunk.trim()) {
            // Regular output - use console.log
            console.log(chunk);
          }
        });
      });

      childProcess.on("close", (code) => {
        if (code === 0) {
          logger.info(`${operationName} completed successfully`);
          resolve(stdout.trim());
        } else {
          const error = stderr || `Process exited with code ${code}`;
          logger.error(`${operationName} failed`, { 
            code, 
            stderr: stderr.slice(-500), // Last 500 chars
            stdout: stdout.slice(-500)
          });
          reject(new SmoltenError(`${operationName} failed: ${error}`, ERROR_CODES.PROCESS_FAILED, { code, stderr, stdout }));
        }
      });

      childProcess.on("error", (error) => {
        logger.error(`${operationName} process error`, { 
          error: error.message 
        });
        reject(new SmoltenError(`${operationName} process error: ${error.message}`, ERROR_CODES.PROCESS_FAILED));
      });
    });
  }
}

export default CSVProcessor;