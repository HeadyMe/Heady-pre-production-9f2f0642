# KDE to MATE Desktop Environment Migration Guide

## Overview
This guide provides comprehensive instructions for replacing KDE Plasma with the MATE desktop environment across your Heady development environments. MATE offers better resource efficiency, stability, and compatibility for development workloads.

## 1. Pre-Migration Preparation

### System Backup
**Critical: Back up your system before proceeding**

```bash
# Create system backup
sudo rsync -aAXv / --exclude={"/dev/*","/proc/*","/sys/*","/tmp/*","/run/*","/mnt/*","/media/*","/lost+found"} /path/to/backup/kde-backup-$(date +%Y%m%d)

# Export package list (Debian/Ubuntu)
dpkg --get-selections > ~/package-list-kde.txt

# Export package list (Fedora)
dnf list installed > ~/package-list-kde.txt

# Export package list (Arch)
pacman -Qqe > ~/package-list-kde.txt
```

### Verify Current Environment
```bash
# Check current desktop
echo $XDG_CURRENT_DESKTOP
echo $DESKTOP_SESSION

# Check display manager
systemctl status display-manager.service

# List KDE packages
# Debian/Ubuntu
dpkg -l | grep kde

# Fedora
dnf list installed | grep kde

# Arch
pacman -Qs kde
```

### Document Customizations
```bash
# Export KDE settings (if needed)
cp -r ~/.kde ~/kde-settings-backup
cp -r ~/.config/kde* ~/kde-config-backup
cp -r ~/.local/share/kde ~/kde-local-backup
```

## 2. Distribution-Specific Installation

### Debian / Ubuntu / Linux Mint / Zorin

#### Install MATE Desktop
```bash
# Update package lists
sudo apt update

# Install MATE desktop environment
sudo apt install mate-desktop-environment

# For Ubuntu-based systems, you might prefer:
sudo apt install ubuntu-mate-desktop

# Install additional MATE components
sudo apt install mate-applets mate-media mate-calc mate-system-tools
```

#### Display Manager Configuration
```bash
# Install LightDM (recommended for MATE)
sudo apt install lightdm lightdm-gtk-greeter

# Configure display manager
sudo dpkg-reconfigure lightdm

# Or switch to LightDM directly
sudo systemctl disable sddm
sudo systemctl enable lightdm
```

#### Verify Installation
```bash
# Check MATE packages
dpkg -l | grep mate

# Verify display manager
systemctl status lightdm
```

### Arch Linux / Manjaro

#### Install MATE Desktop
```bash
# Update system
sudo pacman -Syu

# Install MATE and extra components
sudo pacman -S mate mate-extra

# Install LightDM
sudo pacman -S lightdm lightdm-gtk-greeter

# Enable LightDM
sudo systemctl disable sddm
sudo systemctl enable lightdm
```

#### Verify Installation
```bash
# Check MATE packages
pacman -Qs mate

# Verify display manager
systemctl status lightdm
```

### Fedora / CentOS / RHEL

#### Install MATE Desktop
```bash
# Update system
sudo dnf update

# Install MATE desktop group
sudo dnf groupinstall "MATE Desktop"

# Install additional components
sudo dnf install mate-applets mate-media mate-calc mate-system-tools

# Install LightDM
sudo dnf install lightdm lightdm-gtk-greeter

# Configure display manager
sudo systemctl disable sddm
sudo systemctl enable lightdm
```

#### Verify Installation
```bash
# Check MATE packages
dnf list installed | grep mate

# Verify display manager
systemctl status lightdm
```

## 3. Post-Installation Configuration

### First Boot with MATE
1. **Reboot the system**
2. **At login screen, select MATE session** (gear icon or session menu)
3. **Log in to verify MATE works properly**
4. **Test basic functionality** (panel, menu, windows, file manager)

### MATE Initial Configuration
```bash
# Set MATE as default session (optional)
# Create ~/.dmrc
echo "[Desktop]" > ~/.dmrc
echo "Session=mate" >> ~/.dmrc

# Configure MATE settings
mate-appearance-properties
mate-keybinding-properties
mate-keyboard-properties
```

### Install Essential Applications
```bash
# Debian/Ubuntu
sudo apt install caja file-roller pluma mate-terminal mate-screenshot mate-system-monitor

# Arch
sudo pacman -S caja file-roller pluma mate-terminal mate-screenshot mate-system-monitor

# Fedora
sudo dnf install caja file-roller pluma mate-terminal mate-screenshot mate-system-monitor
```

## 4. KDE Removal Process

### IMPORTANT: Only proceed after confirming MATE works properly

#### Debian / Ubuntu KDE Removal
```bash
# Remove KDE Plasma desktop
sudo apt remove --purge \
  kde-plasma-desktop \
  kde-standard \
  plasma-desktop \
  plasma-workspace \
  plasma-discover \
  plasma-nm \
  plasma-pa \
  kde-runtime \
  kde-config-* \
  kde-baseapps \
  kwin-x11 \
  kde-spectacle \
  konsole \
  dolphin

# Remove KDE applications
sudo apt remove --purge \
  kate \
  kwrite \
  kcalc \
  okular \
  gwenview \
  kmail \
  korganizer \
  kontact

# Clean up
sudo apt autoremove
sudo apt autoclean
```

#### Arch KDE Removal
```bash
# Remove Plasma and KDE applications
sudo pacman -Rns plasma kde-applications kde-baseapps

# Remove specific KDE packages if needed
sudo pacman -Rns $(pacman -Qs kde | cut -d' ' -f1)

# Clean up
sudo pacman -Qtdq | sudo pacman -Rns -
```

#### Fedora KDE Removal
```bash
# Remove KDE Plasma Workspaces
sudo dnf groupremove "KDE Plasma Workspaces"

# Remove KDE applications
sudo dnf remove kate kwrite kcalc okular gwenview kmail korganizer kontact

# Clean up
sudo dnf autoremove
```

### Clean Up Remaining Files
```bash
# Remove KDE configuration directories
rm -rf ~/.kde
rm -rf ~/.config/kde*
rm -rf ~/.local/share/kde
rm -rf ~/.cache/kde

# Remove KDE session files
sudo rm -f /usr/share/xsessions/plasma.desktop
sudo rm -f /usr/share/wayland-sessions/plasma.desktop
```

## 5. MATE Optimization for Development

### Performance Tuning
```bash
# Enable compositing (if needed)
mate-composite --enable

# Configure panel for efficiency
# Right-click panel -> Add to Panel -> Add essential applets only

# Set up workspaces
mate-workspace-preferences
```

### Development Environment Setup
```bash
# Install development tools
sudo apt install build-essential git vim emacs code

# Configure terminal
mate-terminal --preferences

# Set up file manager for development
caja --preferences
```

### Keyboard Shortcuts
```bash
# Configure keyboard shortcuts
mate-keybinding-properties

# Common development shortcuts:
# Ctrl+Alt+T: Terminal
# Ctrl+Alt+F: File Manager
// Super+L: Lock Screen
```

## 6. Application Migration

### Development Tools
| KDE Application | MATE Alternative | Installation Command |
|----------------|------------------|---------------------|
| Kate | Pluma | `sudo apt install pluma` |
| Konsole | Mate Terminal | `sudo apt install mate-terminal` |
| Dolphin | Caja | `sudo apt install caja` |
| KCalc | Mate Calculator | `sudo apt install mate-calc` |
| Spectacle | Mate Screenshot | `sudo apt install mate-screenshot` |
| Okular | Evince | `sudo apt install evince` |

### System Tools
| KDE Application | MATE Alternative | Installation Command |
|----------------|------------------|---------------------|
| KSysGuard | Mate System Monitor | `sudo apt install mate-system-monitor` |
| KRunner | Mate Search | Built into MATE |
| System Settings | Mate Control Center | `sudo apt install mate-control-center` |

## 7. Heady Development Environment Integration

### Windsurf Configuration for MATE
```bash
# Ensure Windsurf works with MATE
# Check if Windsurf is installed
which windsurf

# If not installed, download and install
wget https://windsurf.ai/download/windsurf-linux-x64.deb
sudo dpkg -i windsurf-linux-x64.deb

# Configure Windsurf to work with MATE file manager
# Create desktop entry
cat > ~/.local/share/applications/windsurf.desktop << EOF
[Desktop Entry]
Name=Windsurf
Exec=windsurf %U
Icon=windsurf
Type=Application
Categories=Development;
EOF
```

### Terminal Integration
```bash
# Configure Mate Terminal for Heady development
# Edit profile preferences
mate-terminal --profile-preferences

# Set up custom profile for Heady
mate-terminal --window-with-profile=HeadyDev

# Add Heady aliases to ~/.bashrc
echo 'alias heady-sync="cd ~/CascadeProjects/Heady && ./heady-sync.sh"' >> ~/.bashrc
echo 'alias heady-health="./heady-health-check.sh"' >> ~/.bashrc
```

### File Manager Integration
```bash
# Configure Caja for Heady development
# Add Heady scripts to Caja context menu
mkdir -p ~/.config/caja/scripts

# Create Heady sync script
cat > ~/.config/caja/scripts/HeadySync << EOF
#!/bin/bash
cd ~/CascadeProjects/Heady
./heady-sync.sh
EOF
chmod +x ~/.config/caja/scripts/HeadySync
```

## 8. Troubleshooting

### Common Issues and Solutions

#### Display Manager Issues
```bash
# If LightDM doesn't start
sudo systemctl restart lightdm

# If login loop occurs
# Check ~/.xsession-errors
cat ~/.xsession-errors

# Reset MATE configuration
mv ~/.config/mate ~/.config/mate.bak
```

#### Performance Issues
```bash
# Disable animations for better performance
gsettings set org.mate.interface enable-animations false

# Reduce panel transparency
gsettings set org.mate.panel.background transparency 0

# Optimize window manager
gsettings set org.mate.marco.general reduced-resources true
```

#### Application Compatibility
```bash
# If Qt applications look wrong
sudo apt install qt5ct
qt5ct

# Configure Qt theme to match MATE
```

#### Sound Issues
```bash
# Install pulseaudio for MATE
sudo apt install pulseaudio pulseaudio-utils

# Configure sound settings
mate-volume-control
```

## 9. Verification Checklist

### Post-Migration Verification
- [ ] System boots successfully
- [ ] LightDM login screen appears
- [ ] MATE session selectable and functional
- [ ] Panel and menus work correctly
- [ ] File manager (Caja) opens files
- [ ] Terminal emulator works
- [ ] Network connectivity maintained
- [ ] Development tools accessible
- [ ] Windsurf integration functional
- [ ] Heady scripts execute properly

### Performance Verification
```bash
# Check memory usage
free -h

# Check CPU usage
top

# Check disk usage
df -h

# Check system load
uptime
```

### Application Verification
```bash
# Test essential applications
mate-terminal --version
caja --version
pluma --version

# Test Heady integration
cd ~/CascadeProjects/Heady
./heady-health-check.sh
```

## 10. Rollback Plan

### If Migration Fails
```bash
# Restore from backup
sudo rsync -aAXv /path/to/backup/kde-backup-YYYYMMDD/ /

# Reinstall KDE
# Debian/Ubuntu
sudo apt install kde-plasma-desktop
sudo systemctl enable sddm
sudo systemctl disable lightdm

# Reboot system
sudo reboot
```

### Partial Rollback
```bash
# Keep MATE but reinstall specific KDE apps
sudo apt install kate konsole dolphin

# Use KDE apps in MATE environment
```

## 11. Maintenance

### Regular Maintenance Tasks
```bash
# Update system regularly
sudo apt update && sudo apt upgrade

# Clean package cache
sudo apt autoclean

# Monitor system performance
mate-system-monitor

# Backup configuration
cp -r ~/.config/mate ~/mate-config-backup-$(date +%Y%m%d)
```

### Optimization Tips
- Use lightweight themes for better performance
- Limit startup applications
- Regularly clean temporary files
- Monitor resource usage with system monitor

## 12. Additional Resources

### Documentation
- [MATE Desktop Documentation](https://mate-desktop.org/documentation/)
- [MATE Desktop Wiki](https://wiki.mate-desktop.org/)
- [Distribution-specific MATE guides](https://wiki.archlinux.org/title/MATE)

### Community Support
- [MATE Desktop Forums](https://forums.mate-desktop.org/)
- [MATE Desktop Reddit](https://www.reddit.com/r/MATE_DE/)
- [Distribution-specific support channels]

This migration guide ensures a smooth transition from KDE to MATE while maintaining full Heady development environment functionality and improving system performance and stability.
