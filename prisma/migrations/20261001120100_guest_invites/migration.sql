INSERT INTO "Invitation" ("id", "tableId", "kind", "token", "expiresAt", "createdById", "createdAt")
SELECT
  'gst_' || substr(md5(i."tableId" || i."token"), 1, 21),
  i."tableId",
  'GUEST',
  encode(sha256((i."token" || ':guest')::bytea), 'hex'),
  i."expiresAt",
  i."createdById",
  NOW()
FROM "Invitation" i
WHERE i."kind" = 'QR'
  AND i."revokedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Invitation" g
    WHERE g."tableId" = i."tableId"
      AND g."kind" = 'GUEST'
      AND g."revokedAt" IS NULL
  );
