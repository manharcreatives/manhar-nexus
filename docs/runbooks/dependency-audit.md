# Dependency audit (production dependencies)

Checked with `npm audit --omit=dev`. `npm audit fix` (no `--force`) has been applied: the critical `proxy-addr`
(IP spoofing behind `TRUST_PROXY`), `body-parser` and `qs` findings are fixed.

## Still open (accepted for now, re-check each release)

| Package | Severity | Why it is still here | Why it is acceptable today |
|---|---|---|---|
| `multer` 2.4.0 (via `@nestjs/platform-express` 11.2.8, which pins it exactly) | high | The fix is 2.5.0. An npm `overrides` entry does not work against an exact pin: it drops multer from the tree and breaks `npm ci`. It needs a NestJS release that bumps multer, or a NestJS 12 upgrade. | DoS needs a pending asynchronous `fileFilter` after request teardown. Uploads exist only on the staff picture endpoints (authenticated, size-limited). |
| `zod` 3.25.x | high | The fix is zod 4.6.7 (major). Every DTO schema would need a migration and re-test. | Memory exhaustion needs an oversized constrained collection. Bodies are capped by the JSON body limit (oversized bodies answer 413) and public schemas are `.strict()`. |
| `deepmerge-ts` (via `@prisma/config` 6.19.3, pinned 7.1.5) | high | The fix is deepmerge-ts 8, which Prisma 6 does not accept. | Used by the Prisma CLI config loader at migrate/generate time, never on the request path, and it merges only our own `prisma.config`. |

Do not use `npm audit fix --force`: it would jump NestJS and Prisma to new majors.
Never add an `overrides` entry for a package that a dependency pins exactly; verify with `npm ci` and `npm ls <pkg>`.
