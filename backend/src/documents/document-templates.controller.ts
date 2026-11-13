import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

import {
  CreateDocumentTemplateDto,
  DocumentTemplatesService,
  UpdateDocumentTemplateDto,
} from './document-templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { parseUnlinkFlag } from '../common/deletion/deletion-dependencies';

@RequireFeature('documents')
@UseGuards(JwtAuthGuard, FeatureGuard, PermissionsGuard)
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly templates: DocumentTemplatesService) {}

  @RequirePermissions('documents:view')
  @Get()
  list() {
    return this.templates.list();
  }

  @RequirePermissions('documents:create')
  @Post()
  create(@Body() dto: CreateDocumentTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.templates.create(dto, user);
  }

  @RequirePermissions('documents:edit')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.templates.update(id, dto, user);
  }

  @RequirePermissions('documents:delete')
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('unlink') unlink?: string,
  ) {
    return this.templates.remove(id, user, parseUnlinkFlag(unlink));
  }
}
