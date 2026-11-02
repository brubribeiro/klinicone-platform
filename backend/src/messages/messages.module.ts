import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessageDispatchService } from './message-dispatch.service';

@Module({
  providers: [MessagesService, MessageDispatchService],
  controllers: [MessagesController],
  exports: [MessageDispatchService],
})
export class MessagesModule {}
