import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.module.js';

@Injectable()
export class HealthRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async pingDatabase(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}
