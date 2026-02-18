# ═══════════════════════════════════════════════════════════════
# 🐳 HEADY DRUPAL 11 CMS DOCKERFILE
# ═══════════════════════════════════════════════════════════════
# Production-ready Drupal 11 with headless capabilities

FROM php:8.1-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    oniguruma-dev \
    libxml2-dev \
    zip \
    unzip \
    nginx \
    supervisor \
    rsync

# Install PHP extensions
RUN docker-php-ext-install \
    pdo_mysql \
    pdo_pgsql \
    gd \
    opcache \
    zip \
    mbstring \
    xml \
    curl \
    bcmath \
    intl

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy composer files
COPY composer.json composer.lock ./

# Install Drupal dependencies
RUN composer install --no-dev --optimize-autoloader

# Copy Drupal files
COPY web/ web/

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && find /var/www/html -type d -exec chmod 755 {} \; \
    && find /var/www/html -type f -exec chmod 644 {} \;

# Create necessary directories
RUN mkdir -p /var/www/html/web/sites/default/files \
    && chown -R www-data:www-data /var/www/html/web/sites/default/files

# Copy custom modules
COPY web/modules/custom/ web/modules/custom/

# Copy configuration
COPY config/ web/sites/default/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://cms.headyconnection.org/admin/health || exit 1

# Expose ports
EXPOSE 80 443

# Start script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
