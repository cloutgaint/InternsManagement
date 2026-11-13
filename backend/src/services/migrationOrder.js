export const migrationNumber = (name) => Number(name.match(/^\d+/)?.[0]);

export const compareMigrations = (left, right) =>
  migrationNumber(left) - migrationNumber(right) || left.localeCompare(right);
