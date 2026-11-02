import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { throwError, type Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { mediaMaxBytes } from './guestmenu.config';
import { PayloadTooLargeError } from './guestmenu.errors';

/**
 * Put in front of `FileInterceptor` on the picture routes. Multer rejects an oversize multipart body itself (its
 * `fileSize` limit) and Nest turns that into a bare `413 { code: "ERROR", message: "File too large" }`. This maps it to the
 * same `413 PAYLOAD_TOO_LARGE` envelope the service-level size check uses, so a client sees one code for "too big".
 */
@Injectable()
export class UploadErrorsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpException && err.getStatus() === 413) {
          const mb = Math.max(1, Math.round(mediaMaxBytes() / 1024 / 1024));
          return throwError(() => new PayloadTooLargeError(`The picture is larger than ${mb} MB.`, { maxBytes: mediaMaxBytes() }));
        }
        return throwError(() => err);
      }),
    );
  }
}
