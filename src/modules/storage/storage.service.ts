import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import type { Env } from '../../config/env.schema';
import type {
  CompleteMultipartDto,
  DeleteFileDto,
  GetFileUrlDto,
  InitMultipartDto,
  SignPartsDto,
  StorageContext,
} from './dto';

const MOCK_USER = { id: 'usr_999design', role: 'creator' } as const;

const PRESIGNED_URL_EXPIRES_IN = 60 * 15; // 15 minutes

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const endpoint = this.config.get('R2_ENDPOINT', { infer: true });
    const accessKeyId = this.config.get('R2_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = this.config.get('R2_SECRET_ACCESS_KEY', {
      infer: true,
    });
    this.bucket = this.config.get('R2_BUCKET_NAME', { infer: true });

    this.s3 = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: true,
      // AWS SDK v3 adds CRC32 checksums by default; those break browser
      // PUTs to R2 (extra signed query params / headers → CORS failures).
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  onModuleInit() {
    this.logger.log(
      `R2 client ready (bucket=${this.bucket}, mockUser=${MOCK_USER.id})`,
    );
  }

  async initMultipartUpload(dto: InitMultipartDto) {
    const storageKey = this.buildStorageKey(
      dto.fileName,
      dto.context,
      dto.projectId,
    );

    try {
      const result = await this.s3.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucket,
          Key: storageKey,
          ContentType: dto.fileType,
        }),
      );

      if (!result.UploadId) {
        throw new BadGatewayException('R2 did not return an uploadId');
      }

      return {
        uploadId: result.UploadId,
        storageKey,
      };
    } catch (error) {
      this.rethrowR2Error('init multipart upload', error);
    }
  }

  async signParts(dto: SignPartsDto) {
    this.assertOwnedKey(dto.storageKey);

    try {
      const signed = await Promise.all(
        dto.partNumbers.map(async (partNumber) => {
          const command = new UploadPartCommand({
            Bucket: this.bucket,
            Key: dto.storageKey,
            UploadId: dto.uploadId,
            PartNumber: partNumber,
          });

          const presignedUrl = await getSignedUrl(this.s3, command, {
            expiresIn: PRESIGNED_URL_EXPIRES_IN,
          });

          return { partNumber, presignedUrl };
        }),
      );

      return signed;
    } catch (error) {
      this.rethrowR2Error('sign multipart parts', error);
    }
  }

  async completeMultipartUpload(dto: CompleteMultipartDto) {
    this.assertOwnedKey(dto.storageKey);

    const sortedParts = [...dto.parts].sort(
      (a, b) => a.partNumber - b.partNumber,
    );

    try {
      const result = await this.s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: dto.storageKey,
          UploadId: dto.uploadId,
          MultipartUpload: {
            Parts: sortedParts.map((part) => ({
              PartNumber: part.partNumber,
              ETag: part.eTag,
            })),
          },
        }),
      );

      return {
        storageKey: dto.storageKey,
        location: result.Location ?? null,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      this.rethrowR2Error('complete multipart upload', error);
    }
  }

  async deleteFile(dto: DeleteFileDto) {
    this.assertOwnedKey(dto.storageKey);

    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: dto.storageKey,
        }),
      );

      return { deleted: true, storageKey: dto.storageKey };
    } catch (error) {
      this.rethrowR2Error('delete file', error);
    }
  }

  async getFileUrl(dto: GetFileUrlDto) {
    this.assertOwnedKey(dto.storageKey);

    const disposition = dto.disposition ?? 'inline';
    const fileName =
      dto.fileName?.trim() || basename(dto.storageKey) || 'file';
    const safeName = fileName.replace(/["\r\n]/g, '_');

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: dto.storageKey,
        ResponseContentDisposition: `${disposition}; filename="${safeName}"`,
      });

      const url = await getSignedUrl(this.s3, command, {
        expiresIn: PRESIGNED_URL_EXPIRES_IN,
      });

      return {
        storageKey: dto.storageKey,
        url,
        disposition,
        expiresIn: PRESIGNED_URL_EXPIRES_IN,
      };
    } catch (error) {
      this.rethrowR2Error('sign file url', error);
    }
  }

  private rethrowR2Error(action: string, error: unknown): never {
    const message =
      error instanceof Error ? error.message : 'Unknown R2 error';
    this.logger.error(`Failed to ${action}: ${message}`, error);

    if (error instanceof BadGatewayException || error instanceof ForbiddenException) {
      throw error;
    }

    throw new BadGatewayException(`R2 ${action} failed: ${message}`);
  }

  private buildStorageKey(
    fileName: string,
    context: StorageContext,
    projectId?: string,
  ): string {
    const extension = extname(fileName).toLowerCase();
    const uuid = randomUUID();
    const base = `users/${MOCK_USER.id}`;

    if (context === 'profile') {
      return `${base}/profile/${uuid}${extension}`;
    }

    if (projectId) {
      return `${base}/${context}/${projectId}/${uuid}${extension}`;
    }

    return `${base}/${context}/${uuid}${extension}`;
  }

  private assertOwnedKey(storageKey: string): void {
    const prefix = `users/${MOCK_USER.id}/`;
    if (!storageKey.startsWith(prefix)) {
      throw new ForbiddenException(
        'storageKey does not belong to the current user',
      );
    }
  }
}
