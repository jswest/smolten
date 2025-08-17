import { ERROR_CODES } from "./constants.js";
import userOutput from "./user-output.js";
import logger from "./logger.js";

export class SmoltenError extends Error {
  constructor(message, code = ERROR_CODES.PROCESS_FAILED, details = {}) {
    super(message);
    this.name = "SmoltenError";
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends SmoltenError {
  constructor(message, details = {}) {
    super(message, ERROR_CODES.VALIDATION_FAILED, details);
    this.name = "ValidationError";
  }
}

export class ConfigError extends SmoltenError {
  constructor(message, details = {}) {
    super(message, ERROR_CODES.CONFIG_INVALID, details);
    this.name = "ConfigError";
  }
}

export class PythonEnvironmentError extends SmoltenError {
  constructor(message, code, details = {}) {
    super(message, code, details);
    this.name = "PythonEnvironmentError";
  }
}

export function handleError(error, operation = "operation") {
  const message = `❌ ${operation} failed: ${error.message}`;
  
  if (error instanceof SmoltenError) {
    userOutput.error(message);
    logger.error(`${operation} failed`, {
      code: error.code,
      details: error.details,
      stack: error.stack,
    });
  } else {
    userOutput.error(message);
    logger.error(`Unexpected error during ${operation}`, {
      error: error.message,
      stack: error.stack,
    });
  }
}

export function validateInput(value, validator, fieldName) {
  if (!validator(value)) {
    throw new ValidationError(`Invalid ${fieldName}: ${value}`);
  }
  return value;
}

export function validateRequired(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    throw new ValidationError(`${fieldName} is required`);
  }
  return value;
}