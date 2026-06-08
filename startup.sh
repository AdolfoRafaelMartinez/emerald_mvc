#!/bin/bash
# needed by GCP to deploy

curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get update
apt-get install -y nodejs git
