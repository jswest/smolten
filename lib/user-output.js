import chalk from "chalk";

class UserOutput {
  constructor() {
    this.useColors = process.stdout.isTTY;
  }

  success(message) {
    const symbol = this.useColors ? chalk.green("✓") : "✓";
    console.log(`${symbol} ${message}`);
  }

  error(message) {
    const symbol = this.useColors ? chalk.red("❌") : "❌";
    console.log(`${symbol} ${message}`);
  }

  warning(message) {
    const symbol = this.useColors ? chalk.yellow("⚠️") : "⚠️";
    console.log(`${symbol} ${message}`);
  }

  info(message) {
    console.log(message);
  }

  section(title) {
    if (this.useColors) {
      console.log(chalk.bold.blue(title));
    } else {
      console.log(title);
    }
  }

  progress(message) {
    const symbol = this.useColors ? chalk.blue("🔧") : "🔧";
    console.log(`${symbol} ${message}`);
  }

  newline() {
    console.log("");
  }

  list(items) {
    items.forEach((item) => {
      console.log(`   - ${item}`);
    });
  }

  command(cmd) {
    if (this.useColors) {
      console.log(`   ${chalk.cyan(cmd)}`);
    } else {
      console.log(`   ${cmd}`);
    }
  }

  status(ready, message, details = {}) {
    if (ready) {
      this.success(`Status: ${message}`);
    } else {
      this.error(`Status: ${message}`);
    }

    if (details.python?.installed) {
      this.success(`Python: ${details.python.fullVersion}`);
    } else if (details.python?.error) {
      this.error(`Python: ${details.python.error}`);
    }

    if (details.venv === true) {
      this.success("Virtual environment: Found");
    } else if (details.venv === false) {
      this.error("Virtual environment: Not found");
    }

    if (details.venvActive === true) {
      this.success("Virtual environment: Active");
    } else if (details.venvActive === false && details.venv) {
      this.error("Virtual environment: Cannot activate");
    }

    if (details.packages?.installed) {
      this.success("Required packages: Installed");
    } else if (details.packages?.missing) {
      this.error(`Missing packages: ${details.packages.missing.join(", ")}`);
    }
  }
}

export default new UserOutput();
