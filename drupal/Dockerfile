# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: drupal/Dockerfile                                                    ║
# ║  LAYER: root                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# Drupal 11 with PHP 8.2
FROM drupal:11-php8.2-apache

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    php8.2-pgsql \
    composer \
    && rm -rf /var/lib/apt/lists/*

# Install Drush
RUN composer global require drush/drush

# Set working directory
WORKDIR /var/www/html

# Copy custom settings
COPY settings.php /sites/default/settings.php
RUN chmod 644 /sites/default/settings.php

# Copy all Drupal customizations
COPY themes/custom/ /var/www/html/themes/custom/
COPY modules/custom/ /var/www/html/modules/custom/

# Install Heady theme
RUN drush en heady_theme -y
RUN drush config-set system.theme default heady_theme -y

# Configure SQLite database
RUN mkdir -p /var/www/html/sites/default/files/private
RUN sqlite3 /var/www/html/sites/default/files/.ht.sqlite "VACUUM;"
