import { Module } from '@nestjs/common';
import { EquipmentModule } from '../equipment/equipment.module';
import { MessagesModule } from '../messages/messages.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [EquipmentModule, MessagesModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
