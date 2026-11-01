import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import {
  DocumentsService,
  CreateDocumentDto,
  CreateFromTemplateDto,
  UpdateDocumentDto,
} from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DOCUMENT_ALLOWED_MIMES } from './upload-allowlist';

const UPLOAD_OPTIONS = {
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    // Primeira barreira (MIME declarado); o service valida magic bytes do buffer.
    if (DOCUMENT_ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
    }
  },
};

@RequireFeature('documents')
@UseGuards(JwtAuthGuard, FeatureGuard, PermissionsGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @RequirePermissions('documents:view')
  @Get()
  list(
    @Query('patientId') patientId?: string,
    @Query('equipmentId') equipmentId?: string,
  ) {
    return this.documents.list({ patientId, equipmentId });
  }

  /** Upload de arquivo para o Cloudflare R2 */
  @RequirePermissions('documents:create')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Arquivo é obrigatório.');
    return this.documents.upload(dto, file, user);
  }

  /** Gera um documento a partir de um modelo (termo, ficha, contrato...) */
  @RequirePermissions('documents:create')
  @Post('from-template')
  createFromTemplate(@Body() dto: CreateFromTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.createFromTemplate(dto, user);
  }

  @RequirePermissions('documents:view')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.findOne(id);
  }

  @RequirePermissions('documents:edit')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.update(id, dto, user);
  }

  /** Anexa ou substitui o arquivo (ex.: versão assinada) e marca como assinado */
  @RequirePermissions('documents:edit')
  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  attachFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Arquivo é obrigatório.');
    return this.documents.attachFile(id, file, user);
  }

  @RequirePermissions('documents:view')
  @Get(':id/access-url')
  getAccessUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.getAccessUrl(id);
  }

  @RequirePermissions('documents:delete')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.remove(id, user);
  }
}
