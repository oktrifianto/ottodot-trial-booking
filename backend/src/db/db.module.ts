import { Global, Module } from '@nestjs/common';
import { pool } from './pool';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [{ provide: PG_POOL, useValue: pool }],
  exports: [PG_POOL],
})
export class DbModule {}
