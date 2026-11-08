#!/bin/sh
# Dev only: allow anonymous s3:GetObject (no ListBucket) on the media buckets.
set -eu
MC=/opt/bitnami/minio-client/bin/mc
"$MC" alias set local http://minio:9000 skytech skytech-dev-secret >/dev/null

for bucket in skytech-media skytech-media-test; do
  "$MC" mb --ignore-existing "local/$bucket" >/dev/null
  cat > "/tmp/$bucket.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::$bucket/*"]
    }
  ]
}
EOF
  "$MC" anonymous set-json "/tmp/$bucket.json" "local/$bucket"
done
echo "media buckets: anonymous read-only by key"
