import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function typeMatches(value, expected) {
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'null') return value === null;
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === expected;
}

function formatPath(path, key) {
  if (typeof key === 'number') return `${path}[${key}]`;
  return `${path}.${key}`;
}

function resolveRef(ref, rootSchema) {
  if (ref !== '#/$defs/track') {
    throw new Error(`Unsupported schema ref: ${ref}`);
  }
  return rootSchema?.$defs?.track;
}

function validateAgainstAnyOf(value, schemas, path, rootSchema) {
  for (const schema of schemas) {
    if (validateValue(value, schema, { path, rootSchema }).length === 0) {
      return [];
    }
  }
  return [`${path} must match at least one schema.`];
}

export function validateValue(value, schema, options = {}) {
  const path = options.path || '$';
  const rootSchema = options.rootSchema || schema;
  const errors = [];

  if (schema.$ref) {
    return validateValue(value, resolveRef(schema.$ref, rootSchema), { path, rootSchema });
  }

  if (schema.anyOf) {
    errors.push(...validateAgainstAnyOf(value, schema.anyOf, path, rootSchema));
    if (errors.length > 0) return errors;
  }

  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push(`${path} must be ${schema.type}.`);
    return errors;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of: ${schema.enum.join(', ')}.`);
  }

  if (typeof schema.minLength === 'number' && typeof value === 'string' && value.length < schema.minLength) {
    errors.push(`${path} must be at least ${schema.minLength} character${schema.minLength === 1 ? '' : 's'}.`);
  }

  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
    errors.push(`${path} must match pattern: ${schema.pattern}.`);
  }

  if (schema.required && typeName(value) === 'object') {
    for (const key of schema.required) {
      if (!Object.hasOwn(value, key)) {
        errors.push(`${formatPath(path, key)} is required.`);
      }
    }
  }

  if (schema.properties && typeName(value) === 'object') {
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      if (Object.hasOwn(value, key)) {
        errors.push(...validateValue(value[key], propertySchema, {
          path: formatPath(path, key),
          rootSchema,
        }));
      }
    }
  }

  if (schema.items && Array.isArray(value)) {
    value.forEach((item, index) => {
      errors.push(...validateValue(item, schema.items, {
        path: formatPath(path, index),
        rootSchema,
      }));
    });
  }

  return errors;
}

async function main() {
  const catalogUrl = new URL('../sounds.json', import.meta.url);
  const schemaUrl = new URL('../catalog.schema.json', import.meta.url);
  const reportUrl = new URL('../catalog-schema-report.json', import.meta.url);
  const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
  const schema = JSON.parse(await readFile(schemaUrl, 'utf8'));
  const errors = validateValue(catalog, schema);
  const report = {
    ok: errors.length === 0,
    errors,
  };

  await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Catalog schema validation ${report.ok ? 'passed' : 'failed'}.`);
  console.log(`Errors: ${errors.length}`);

  if (!report.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
