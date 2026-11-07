#!/bin/sh
# usage: up.sh <file> <signed-url>
f="$1"; u="$2"; n=$(basename "$f"); s=$(stat -c %s "$f")
curl -s -o /dev/null -w "%{http_code}\n" -X PUT --data-binary @"$f" -H "content-type: image/png" -H "cache-control: public, max-age=31536000" -H "x-goog-content-length-range: $s,$s" -H "Content-Disposition: attachment; filename=\"$n\"" "$u"
