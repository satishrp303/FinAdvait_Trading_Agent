// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const desks = sqliteTable('desks', {owner:text('owner').primaryKey(),revision:integer('revision').notNull(),state:text('state').notNull()});
