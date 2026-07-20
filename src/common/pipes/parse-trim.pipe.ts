import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

/** Placeholder for shared custom pipes. Prefer ValidationPipe for DTO validation. */
@Injectable()
export class ParseTrimPipe implements PipeTransform<string, string> {
  transform(value: string, _metadata: ArgumentMetadata): string {
    return typeof value === 'string' ? value.trim() : value;
  }
}
