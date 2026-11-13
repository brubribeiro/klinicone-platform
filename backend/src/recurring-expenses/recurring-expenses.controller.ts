import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RecurringExpensesService } from './recurring-expenses.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';
import { HourlyCostSettingsDto } from './dto/hourly-cost-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { parseUnlinkFlag } from '../common/deletion/deletion-dependencies';

@RequireFeature('recurring_expenses')
@UseGuards(JwtAuthGuard, FeatureGuard, PermissionsGuard)
@Controller('recurring-expenses')
export class RecurringExpensesController {
  constructor(private readonly service: RecurringExpensesService) {}

  @RequirePermissions('finance:view')
  @Get()
  list() {
    return this.service.list();
  }

  @RequirePermissions('finance:view')
  @Get('hourly-cost-settings')
  hourlyCostSettings() {
    return this.service.getHourlyCostSettings();
  }

  @RequirePermissions('finance:edit')
  @Patch('hourly-cost-settings')
  updateHourlyCostSettings(@Body() dto: HourlyCostSettingsDto) {
    return this.service.setHourlyCostSettings(dto.includeVariable);
  }

  @RequirePermissions('finance:view')
  @Get('hourly-cost-summary')
  hourlyCostSummary(@Query('includeVariable') includeVariable?: string) {
    if (includeVariable === undefined || includeVariable === '') {
      return this.service.getHourlyCostSummary();
    }
    return this.service.getHourlyCostSummary(includeVariable === 'true');
  }

  @RequirePermissions('finance:create')
  @Post('generate')
  generate(@Query('year') year?: string, @Query('month') month?: string) {
    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) : now.getMonth() + 1;
    return this.service.generateForMonth(y, m);
  }

  @RequirePermissions('finance:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions('finance:create')
  @Post()
  create(@Body() dto: CreateRecurringExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @RequirePermissions('finance:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecurringExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions('finance:delete')
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('unlink') unlink?: string,
  ) {
    return this.service.remove(id, user, parseUnlinkFlag(unlink));
  }
}
