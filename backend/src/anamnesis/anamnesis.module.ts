import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PatientsModule } from '../patients/patients.module';
import { AnamnesisService } from './anamnesis.service';
import { AnamnesisController } from './anamnesis.controller';
import { AnamnesisPublicController } from './anamnesis-public.controller';

@Module({
  imports: [PrismaModule, PatientsModule],
  providers: [AnamnesisService],
  controllers: [AnamnesisController, AnamnesisPublicController],
})
export class AnamnesisModule {}
