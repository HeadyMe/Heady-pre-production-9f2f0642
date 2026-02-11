#!/bin/bash

# Install required modules
drush en oauth2_jwt -y

# Configure OAuth client
drush config:set oauth2_jwt.settings client_id "heady-client"
drush config:set oauth2_jwt.settings client_secret "$HEADY_CLIENT_SECRET"
drush config:set oauth2_jwt.settings token_url "https://api.heady-sys.cloud/oauth/token"
drush config:set oauth2_jwt.settings jwks_url "https://api.heady-sys.cloud/.well-known/jwks.json"

# Set permissions for authenticated users
