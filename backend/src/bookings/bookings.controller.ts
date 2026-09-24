import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PayBookingDto } from './dto/pay-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(dto.studentId, dto.classId);
  }

  @Post(':id/pay')
  pay(@Param('id', ParseIntPipe) id: number, @Body() dto: PayBookingDto) {
    return this.bookingsService.payBooking(id, dto.idempotencyKey, dto.simulate);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.getBooking(id);
  }
}
