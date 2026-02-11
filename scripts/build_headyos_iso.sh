#!/bin/bash
# HeadyOS ISO Builder
BASE_ISO="debian-live-12.5.0-amd64-mate.iso"
OUTPUT_ISO="headyos-live-$(date +%Y%m%d).iso"
PERSISTENT_SIZE="4G"

# Download base ISO
wget https://cdimage.debian.org/debian-cd/current-live/amd64/iso-hybrid/$BASE_ISO

# Mount and extract ISO
mkdir -p iso_mount iso_extract
sudo mount -o loop $BASE_ISO iso_mount
rsync -a iso_mount/ iso_extract/
sudo umount iso_mount

# Add Heady components
rsync -avP c:\Users\erich\Heady\distribution\headyos\ iso_extract/headyos/

# Configure persistent storage
cat <<EOF | sudo tee iso_extract/live/persistent.conf
[Persistence]
Enabled=true
Size=$PERSISTENT_SIZE
Encryption=luks
EOF

# Add Heady desktop entry
cat <<EOF | sudo tee iso_extract/headyos.desktop
[Desktop Entry]
Name=HeadyOS Launcher
Exec=/headyos/heady-launcher
Icon=/headyos/heady-icon.png
Type=Application
Categories=System;
EOF

# Build new ISO
dd if=/dev/zero of=$OUTPUT_ISO bs=1M count=0 seek=4096
mkfs.vfat $OUTPUT_ISO
mcopy -i $OUTPUT_ISO iso_extract/* ::

# Cleanup
rm -rf iso_mount iso_extract

echo "HeadyOS ISO created: $OUTPUT_ISO"
