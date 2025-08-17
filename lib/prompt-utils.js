import { confirm, input } from "@inquirer/prompts";

export async function askYesNo(message) {
  return await confirm({
    message,
    default: true,
  });
}

export async function askQuestion(message) {
  return await input({
    message,
  });
}

export async function askChoice(message, choices) {
  const { select } = await import("@inquirer/prompts");
  return await select({
    message,
    choices,
  });
}
