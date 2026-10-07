#!/bin/sh
set -eu
install -o rabbitmq -g rabbitmq -m 600 /run/secrets/rabbitmq_config /etc/rabbitmq/rabbitmq.conf
exec /usr/local/bin/docker-entrypoint.sh rabbitmq-server
