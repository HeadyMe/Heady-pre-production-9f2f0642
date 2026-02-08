# Drupal 11 with PHP 8.2
FROM drupal:11-php8.2-apache

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /var/www/html

# Copy custom settings
COPY settings.php /sites/default/settings.php
RUN chmod 644 /sites/default/settings.php
