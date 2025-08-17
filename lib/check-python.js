import PythonEnvironment from "./python-env.js";
import userOutput from "./user-output.js";

async function main() {
  const env = new PythonEnvironment();
  const status = await env.getEnvironmentStatus();

  userOutput.section("Python Environment Status");
  userOutput.section("========================");
  userOutput.newline();

  userOutput.status(status.ready, status.message, status.details);

  if (status.ready) {
    userOutput.newline();
    userOutput.info("Ready to tag CSV files!");
  } else {
    userOutput.newline();
    userOutput.info("To fix this, run:");
    userOutput.command("npm run setup-python");
  }

  process.exit(status.ready ? 0 : 1);
}

main();
