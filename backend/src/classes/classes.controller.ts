import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ClassesService } from './classes.service';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  list() {
    return this.classesService.listWithSeatsLeft();
  }

  @Get(':id/roster')
  roster(@Param('id', ParseIntPipe) id: number) {
    return this.classesService.roster(id);
  }
}
