import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { ClassesModule } from './classes/classes.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [DbModule, ClassesModule, BookingsModule],
})
export class AppModule {}
