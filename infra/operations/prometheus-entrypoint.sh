#!/bin/sh
set -eu
mkdir -p /run/sc-secret
cp /run/secrets/observer_secret /run/sc-secret/observer.secret
chmod 600 /run/sc-secret/observer.secret
chown 65534:65534 /run/sc-secret /run/sc-secret/observer.secret /prometheus
exec su -s /bin/sh nobody -c 'exec /bin/prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/prometheus --storage.tsdb.retention.time=7d'
