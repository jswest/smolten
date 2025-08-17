import chalk from "chalk";

class CLIOutput {
  constructor() {
    this.useColors = process.stdout.isTTY;
    this.currentLine = "";
    this.isInProgress = false;
    this.terminalWidth = process.stdout.columns || 80;
  }

  // Core in-place update method
  updateInPlace(message, emoji = "🔧") {
    if (!this.useColors) {
      console.log(`${emoji} ${message}`);
      return;
    }

    // Clear current line and write new content
    const fullMessage = `${emoji} ${message}`;
    const truncated = this.truncateToTerminal(fullMessage);
    
    process.stdout.write(`\r${truncated}`);
    this.currentLine = truncated;
    this.isInProgress = true;
  }

  // Complete current operation and move to next line
  complete(message, emoji = "✅") {
    if (this.isInProgress) {
      this.clearCurrentLine();
    }
    
    const fullMessage = `${emoji} ${message}`;
    console.log(fullMessage);
    this.isInProgress = false;
    this.currentLine = "";
  }

  // Show error and move to next line
  error(message, emoji = "❌") {
    if (this.isInProgress) {
      this.clearCurrentLine();
    }
    
    const fullMessage = this.useColors 
      ? `${chalk.red(emoji)} ${message}`
      : `${emoji} ${message}`;
    console.log(fullMessage);
    this.isInProgress = false;
    this.currentLine = "";
  }

  // Show warning and move to next line
  warning(message, emoji = "⚠️") {
    if (this.isInProgress) {
      this.clearCurrentLine();
    }
    
    const fullMessage = this.useColors 
      ? `${chalk.yellow(emoji)} ${message}`
      : `${emoji} ${message}`;
    console.log(fullMessage);
    this.isInProgress = false;
    this.currentLine = "";
  }

  // Show info message and move to next line
  info(message, emoji = "ℹ️") {
    if (this.isInProgress) {
      this.clearCurrentLine();
    }
    
    console.log(`${emoji} ${message}`);
    this.isInProgress = false;
    this.currentLine = "";
  }

  // Progress updates for long operations
  progress(message, percentage = null, emoji = "🌋") {
    let displayMessage = message;
    
    if (percentage !== null) {
      const pct = Math.round(percentage);
      displayMessage = `${message} (${pct}%)`;
    }
    
    this.updateInPlace(displayMessage, emoji);
  }

  // Special molten-themed methods
  moltenProgress(message, emoji = "🌋") {
    this.updateInPlace(message, emoji);
  }

  moltenComplete(message, emoji = "💎") {
    this.complete(message, emoji);
  }

  // Interactive prompts (these need to clear in-progress first)
  prompt() {
    if (this.isInProgress) {
      this.clearCurrentLine();
      this.isInProgress = false;
    }
  }

  // Utility methods
  clearCurrentLine() {
    if (this.currentLine && this.useColors) {
      process.stdout.write(`\r${' '.repeat(this.currentLine.length)}\r`);
    }
  }

  truncateToTerminal(text) {
    if (text.length <= this.terminalWidth - 2) {
      return text;
    }
    return text.substring(0, this.terminalWidth - 5) + "...";
  }

  // Force a clean newline (useful before prompts)
  newline() {
    if (this.isInProgress) {
      this.clearCurrentLine();
      this.isInProgress = false;
    }
    console.log("");
  }

  // Raw output for special cases (bypasses in-place logic)
  raw(text) {
    if (this.isInProgress) {
      this.clearCurrentLine();
    }
    process.stdout.write(text);
    this.isInProgress = false;
  }
}

export default new CLIOutput();