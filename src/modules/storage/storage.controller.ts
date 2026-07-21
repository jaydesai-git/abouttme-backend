import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CompleteMultipartDto,
  DeleteFileDto,
  GetFileUrlDto,
  InitMultipartDto,
  SignPartsDto,
} from './dto';
import { StorageService } from './storage.service';

@ApiTags('demo-storage')
@Controller('api/v1/demo/storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('multipart/init')
  @ApiOperation({ summary: 'Initialize a multipart upload to R2' })
  @ApiOkResponse({ description: 'Returns uploadId and storageKey' })
  initMultipart(@Body() dto: InitMultipartDto) {
    return this.storageService.initMultipartUpload(dto);
  }

  @Post('multipart/sign-parts')
  @ApiOperation({ summary: 'Generate presigned URLs for upload parts' })
  @ApiOkResponse({ description: 'Returns partNumber + presignedUrl pairs' })
  signParts(@Body() dto: SignPartsDto) {
    return this.storageService.signParts(dto);
  }

  @Post('multipart/complete')
  @ApiOperation({ summary: 'Complete a multipart upload' })
  @ApiOkResponse({ description: 'Multipart upload finalized' })
  completeMultipart(@Body() dto: CompleteMultipartDto) {
    return this.storageService.completeMultipartUpload(dto);
  }

  @Post('file/url')
  @ApiOperation({
    summary: 'Get a presigned URL to view or download an owned file',
  })
  @ApiOkResponse({ description: 'Returns a temporary signed GET URL' })
  getFileUrl(@Body() dto: GetFileUrlDto) {
    return this.storageService.getFileUrl(dto);
  }

  @Delete('file')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an owned object from R2' })
  @ApiOkResponse({ description: 'Object deleted' })
  deleteFile(@Body() dto: DeleteFileDto) {
    return this.storageService.deleteFile(dto);
  }
}
