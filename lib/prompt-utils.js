import { confirm, input, select } from "@inquirer/prompts";

export async function askYesNo(message, defaultValue = true) {
  return await confirm({
    message,
    default: defaultValue,
  });
}

export async function askQuestion(message, defaultValue = "") {
  return await input({
    message,
    default: defaultValue,
  });
}

export async function askChoice(message, choices, defaultValue = null) {
  return await select({
    message,
    choices,
    default: defaultValue,
  });
}
