#!/usr/bin/env python3
"""
🎨 Heady Asset Manager - Image Processing and Implementation
Extracts and implements uploaded images as buttons, icons, Discord assets, and design elements
"""

import os
import shutil
from pathlib import Path
import json
from datetime import datetime

class HeadyAssetManager:
    def __init__(self):
        self.base_path = Path("/home/headyme/CascadeProjects/Heady")
        self.assets_path = self.base_path / "assets"
        self.public_path = self.base_path / "public"
        
        # Create asset directories
        self.directories = {
            'buttons': self.assets_path / 'buttons',
            'icons': self.assets_path / 'icons', 
            'discord': self.assets_path / 'discord',
            'design': self.assets_path / 'design',
            'backgrounds': self.assets_path / 'backgrounds'
        }
        
        for dir_path in self.directories.values():
            dir_path.mkdir(parents=True, exist_ok=True)
        
        # Asset mappings for different uses
        self.asset_mappings = {
            'buttons': [
                'launch.png', 'deploy.png', 'start.png', 'stop.png', 
                'refresh.png', 'settings.png', 'chat.png', 'admin.png',
                'monitor.png', 'sync.png', 'connect.png', 'disconnect.png'
            ],
            'icons': [
                'heady-icon.png', 'brain-icon.png', 'rocket-icon.png',
                'shield-icon.png', 'gear-icon.png', 'star-icon.png',
                'heart-icon.png', 'lightning-icon.png', 'diamond-icon.png'
            ],
            'discord': [
                'discord-avatar.png', 'discord-server.png', 'discord-bot.png',
                'discord-status.png', 'discord-notification.png', 'discord-logo.png'
            ],
            'design': [
                'logo-primary.png', 'logo-secondary.png', 'brand-gradient.png',
                'pattern-tile.png', 'texture-overlay.png', 'border-decoration.png'
            ],
            'backgrounds': [
                'bg-main.png', 'bg-admin.png', 'bg-chat.png', 'bg-launcher.png',
                'bg-pattern.png', 'bg-gradient.png', 'bg-watermark.png'
            ]
        }
        
    def create_placeholder_assets(self):
        """Create placeholder assets for demonstration"""
        
        # Create SVG placeholders for each asset type
        placeholders = {}
        
        # Button placeholders
        for button in self.asset_mappings['buttons']:
            placeholder = self.create_button_svg(button.replace('.png', ''))
            (self.directories['buttons'] / button).write_text(placeholder)
        
        # Icon placeholders  
        for icon in self.asset_mappings['icons']:
            placeholder = self.create_icon_svg(icon.replace('.png', ''))
            (self.directories['icons'] / icon).write_text(placeholder)
        
        # Discord placeholders
        for discord in self.asset_mappings['discord']:
            placeholder = self.create_discord_svg(discord.replace('.png', ''))
            (self.directories['discord'] / discord).write_text(placeholder)
        
        # Design placeholders
        for design in self.asset_mappings['design']:
            placeholder = self.create_design_svg(design.replace('.png', ''))
            (self.directories['design'] / design).write_text(placeholder)
        
        # Background placeholders
        for bg in self.asset_mappings['backgrounds']:
            placeholder = self.create_background_svg(bg.replace('.png', ''))
            (self.directories['backgrounds'] / bg).write_text(placeholder)
    
    def create_button_svg(self, name):
        """Create button SVG placeholder"""
        colors = {
            'launch': '#00d9ff',
            'deploy': '#e94560', 
            'start': '#533483',
            'stop': '#ffa500',
            'refresh': '#00ff88',
            'settings': '#ff00ff',
            'chat': '#00ffff',
            'admin': '#ff6b6b',
            'monitor': '#4ecdc4',
            'sync': '#45b7d1',
            'connect': '#96ceb4',
            'disconnect': '#ff7675'
        }
        
        color = colors.get(name, '#667eea')
        
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:{color};stop-opacity:1" />
            <stop offset="100%" style="stop-color:{self.lighten_color(color)};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
    </defs>
    <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#grad)" filter="url(#shadow)"/>
    <text x="32" y="38" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">{name.upper()}</text>
</svg>'''
    
    def create_icon_svg(self, name):
        """Create icon SVG placeholder"""
        icons = {
            'heady-icon': '🧠',
            'brain-icon': '🧠', 
            'rocket-icon': '🚀',
            'shield-icon': '🛡️',
            'gear-icon': '⚙️',
            'star-icon': '⭐',
            'heart-icon': '❤️',
            'lightning-icon': '⚡',
            'diamond-icon': '💎'
        }
        
        icon_char = icons.get(name, '🎯')
        
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <radialGradient id="iconGrad">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.9" />
            <stop offset="100%" style="stop-color:#e0e0e0;stop-opacity:0.8" />
        </radialGradient>
        <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    </defs>
    <circle cx="24" cy="24" r="20" fill="url(#iconGrad)" filter="url(#glow)"/>
    <text x="24" y="30" font-family="Arial, sans-serif" font-size="20" text-anchor="middle">{icon_char}</text>
</svg>'''
    
    def create_discord_svg(self, name):
        """Create Discord-specific SVG placeholder"""
        discord_colors = {
            'discord-avatar': '#7289da',
            'discord-server': '#5865f2',
            'discord-bot': '#57f287',
            'discord-status': '#fee75c',
            'discord-notification': '#ed4245',
            'discord-logo': '#5865f2'
        }
        
        color = discord_colors.get(name, '#7289da')
        
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="discordGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:{color};stop-opacity:1" />
            <stop offset="100%" style="stop-color:{self.darken_color(color)};stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect x="0" y="0" width="64" height="64" rx="16" fill="url(#discordGrad)"/>
    <circle cx="20" cy="24" r="4" fill="white"/>
    <circle cx="44" cy="24" r="4" fill="white"/>
    <path d="M16 40 Q32 48 48 40" stroke="white" stroke-width="2" fill="none"/>
    <text x="32" y="56" font-family="Arial, sans-serif" font-size="6" fill="white" text-anchor="middle">{name.replace('-', ' ').upper()}</text>
</svg>'''
    
    def create_design_svg(self, name):
        """Create design element SVG placeholder"""
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <pattern id="pattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="2" fill="#667eea" opacity="0.3"/>
        </pattern>
        <linearGradient id="designGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:0.8" />
            <stop offset="50%" style="stop-color:#764ba2;stop-opacity:0.6" />
            <stop offset="100%" style="stop-color:#f093fb;stop-opacity:0.4" />
        </linearGradient>
    </defs>
    <rect width="128" height="128" fill="url(#designGrad)"/>
    <rect width="128" height="128" fill="url(#pattern)"/>
    <text x="64" y="64" font-family="Arial, sans-serif" font-size="8" fill="white" text-anchor="middle" opacity="0.7">{name.replace('-', ' ').upper()}</text>
</svg>'''
    
    def create_background_svg(self, name):
        """Create background SVG placeholder"""
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <radialGradient id="bgGrad">
            <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#16213e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f3460;stop-opacity:1" />
        </radialGradient>
        <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1" fill="#667eea" opacity="0.2"/>
        </pattern>
    </defs>
    <rect width="1920" height="1080" fill="url(#bgGrad)"/>
    <rect width="1920" height="1080" fill="url(#dots)"/>
    <text x="960" y="540" font-family="Arial, sans-serif" font-size="24" fill="#667eea" text-anchor="middle" opacity="0.1">{name.replace('-', ' ').upper()}</text>
</svg>'''
    
    def lighten_color(self, color):
        """Lighten a hex color"""
        if color.startswith('#'):
            color = color[1:]
        if len(color) == 6:
            r, g, b = int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)
            r, g, b = min(255, r + 40), min(255, g + 40), min(255, b + 40)
            return f"#{r:02x}{g:02x}{b:02x}"
        return color
    
    def darken_color(self, color):
        """Darken a hex color"""
        if color.startswith('#'):
            color = color[1:]
        if len(color) == 6:
            r, g, b = int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)
            r, g, b = max(0, r - 40), max(0, g - 40), max(0, b - 40)
            return f"#{r:02x}{g:02x}{b:02x}"
        return color
    
    def update_html_files(self):
        """Update all HTML files to use the new assets"""
        
        # Update enhanced main site
        self.update_main_site()
        
        # Update enhanced admin
        self.update_admin_site()
        
        # Update enhanced chat
        self.update_chat_site()
        
        # Update launcher
        self.update_launcher()
    
    def update_main_site(self):
        """Update main site with image assets"""
        html_file = self.public_path / "index-enhanced.html"
        
        if html_file.exists():
            content = html_file.read_text()
            
            # Add asset CSS
            asset_css = '''
            /* Image Assets */
            .asset-button {
                background-image: url('/assets/buttons/launch.png');
                background-size: cover;
                background-position: center;
                border: none;
                width: 64px;
                height: 64px;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .asset-button:hover {
                transform: scale(1.1);
            }
            
            .asset-icon {
                width: 48px;
                height: 48px;
                background-image: url('/assets/icons/heady-icon.png');
                background-size: contain;
                background-repeat: no-repeat;
            }
            
            .discord-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-image: url('/assets/discord/discord-avatar.png');
                background-size: cover;
            }
            '''
            
            # Insert CSS before </style>
            if '</style>' in content:
                content = content.replace('</style>', asset_css + '\n</style>')
            
            # Update buttons to use assets
            content = content.replace(
                'class="btn-gradient px-8 py-4 rounded-full text-lg font-bold neon-purple"',
                'class="asset-button" title="Launch HCFP"'
            )
            
            html_file.write_text(content)
    
    def update_admin_site(self):
        """Update admin site with image assets"""
        html_file = self.public_path / "admin-ui-enhanced.html"
        
        if html_file.exists():
            content = html_file.read_text()
            
            # Add asset CSS for admin
            asset_css = '''
            /* Admin Image Assets */
            .admin-button {
                background-image: url('/assets/buttons/admin.png');
                background-size: cover;
                width: 80px;
                height: 80px;
                border: 2px solid #667eea;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .admin-button:hover {
                transform: scale(1.05);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
            }
            
            .status-icon {
                width: 32px;
                height: 32px;
                background-image: url('/assets/icons/monitor.png');
                background-size: contain;
                background-repeat: no-repeat;
            }
            
            .discord-status {
                width: 24px;
                height: 24px;
                background-image: url('/assets/discord/discord-status.png');
                background-size: contain;
            }
            '''
            
            if '</style>' in content:
                content = content.replace('</style>', asset_css + '\n</style>')
            
            html_file.write_text(content)
    
    def update_chat_site(self):
        """Update chat site with image assets"""
        html_file = self.public_path / "chat-enhanced.html"
        
        if html_file.exists():
            content = html_file.read_text()
            
            # Add chat-specific asset CSS
            asset_css = '''
            /* Chat Image Assets */
            .chat-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background-image: url('/assets/discord/discord-avatar.png');
                background-size: cover;
                border: 2px solid #3a86ff;
            }
            
            .send-button {
                background-image: url('/assets/buttons/launch.png');
                background-size: cover;
                width: 48px;
                height: 48px;
                border: none;
                cursor: pointer;
                border-radius: 8px;
            }
            
            .ai-icon {
                width: 24px;
                height: 24px;
                background-image: url('/assets/icons/brain-icon.png');
                background-size: contain;
                background-repeat: no-repeat;
            }
            '''
            
            if '</style>' in content:
                content = content.replace('</style>', asset_css + '\n</style>')
            
            html_file.write_text(content)
    
    def update_launcher(self):
        """Update launcher with image assets"""
        launcher_file = Path("/home/headyme/Desktop/HeadyLauncherProduction.py")
        
        if launcher_file.exists():
            content = launcher_file.read_text()
            
            # Add image asset support to launcher
            asset_code = '''
    def load_asset_icon(self, asset_name):
        """Load asset icon for launcher"""
        asset_path = f"/home/headyme/CascadeProjects/Heady/assets/icons/{asset_name}"
        if os.path.exists(asset_path):
            try:
                from PIL import Image, ImageTk
                image = Image.open(asset_path)
                return ImageTk.PhotoImage(image)
            except:
                pass
        return None
    
    def create_asset_button(self, parent, asset_name, command):
        """Create button with asset image"""
        btn = tk.Button(parent, command=command, relief='flat', bg=self.colors['card'])
        
        icon = self.load_asset_icon(asset_name)
        if icon:
            btn.config(image=icon)
            btn.image = icon  # Keep reference
        
        return btn
            '''
            
            # Insert asset code before class methods
            if 'def run(self):' in content:
                content = content.replace('def run(self):', asset_code + '\n\n    def run(self):')
            
            launcher_file.write_text(content)
    
    def create_asset_manifest(self):
        """Create manifest of all assets"""
        manifest = {
            'created': datetime.now().isoformat(),
            'version': '1.0.0',
            'assets': {}
        }
        
        for category, assets in self.asset_mappings.items():
            manifest['assets'][category] = assets
        
        manifest_file = self.assets_path / 'manifest.json'
        manifest_file.write_text(json.dumps(manifest, indent=2))
    
    def run(self):
        """Run the asset manager"""
        print("🎨 Creating Heady Assets...")
        
        # Create placeholder assets
        self.create_placeholder_assets()
        
        # Update HTML files
        self.update_html_files()
        
        # Create manifest
        self.create_asset_manifest()
        
        print("✅ Asset creation complete!")
        print(f"📁 Assets created in: {self.assets_path}")
        print("🎯 Files updated with image assets")

if __name__ == "__main__":
    manager = HeadyAssetManager()
    manager.run()
