#!/usr/bin/env python3
"""
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
█▓▒░            🌌 SACRED GEOMETRY ICON EXTRACTOR 🌌           ░▒▓█
█▓▒░          Organic Systems • Breathing Interfaces           ░▒▓█
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█

FILE: icon-extraction-script.py
LAYER: assets/sacred-geometry/icons
PURPOSE: Extract 36 sacred geometry icons from grid image

🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
🌊 Maximum Global Happiness through AI-Powered Social Impact

█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw
import os
import json

def extract_sacred_icons():
    """Extract the 36 sacred geometry icons from the grid image"""
    
    # Create output directory
    output_dir = "/home/headyme/CascadeProjects/Heady/assets/sacred-geometry/icons/extracted"
    os.makedirs(output_dir, exist_ok=True)
    
    # Load the grid image
    image_path = "/home/headyme/Downloads/Gemini_Generated_Image_f8r2nof8r2nof8r2.jpeg"
    
    try:
        # Open with PIL for better handling
        img = Image.open(image_path)
        img_array = np.array(img)
        
        # Get dimensions
        height, width = img_array.shape[:2]
        
        # Calculate grid cell size (6x6 grid)
        cell_width = width // 6
        cell_height = height // 6
        
        # Icon names based on visual analysis
        icon_names = [
            # Row 1 - Metatron's Cube Family
            ["metatrons-cube-01", "crystal-cluster-02", "merkaba-star-03", "sacred-geometry-04", "node-network-05", "geometric-web-06"],
            # Row 2 - Metatron's Cube Family (continued)
            ["metatrons-cube-07", "crystal-cluster-08", "merkaba-star-09", "sacred-geometry-10", "node-network-11", "geometric-web-12"],
            # Row 3 - Organic Patterns
            ["yin-yang-flow", "cellular-organic", "flower-of-life", "tree-of-life", "butterfly-transformation", "dripping-organic"],
            # Row 4 - Energy Patterns
            ["rainbow-burst", "galaxy-spiral", "sacred-grid", "waveform-energy", "aurora-flow", "energy-vortex"],
            # Row 5 - Dimensional Geometry
            ["aurora-watermark", "cube-sacred", "octahedron-divine", "dodecahedron-cosmic", "icosahedron-sacred", "tetrahedron-divine"],
            # Row 6 - Dimensional Geometry (continued)
            ["merkaba-rotating", "nested-polyhedra", "sacred-sphere", "crystalline-structure", "geometric-mandala", "divine-proportion"]
        ]
        
        extracted_icons = []
        
        # Extract each icon
        for row in range(6):
            for col in range(6):
                # Calculate coordinates
                x_start = col * cell_width
                y_start = row * cell_height
                x_end = (col + 1) * cell_width
                y_end = (row + 1) * cell_height
                
                # Extract icon
                icon_img = img.crop((x_start, y_start, x_end, y_end))
                
                # Get icon name
                icon_name = icon_names[row][col]
                
                # Save as PNG with transparency
                icon_path = os.path.join(output_dir, f"{icon_name}.png")
                icon_img.save(icon_path, "PNG")
                
                # Create SVG version (simplified)
                svg_path = os.path.join(output_dir, f"{icon_name}.svg")
                create_simple_svg(icon_path, svg_path, icon_name)
                
                # Record extraction
                extracted_icons.append({
                    "name": icon_name,
                    "row": row + 1,
                    "col": col + 1,
                    "category": get_icon_category(row),
                    "png_path": f"extracted/{icon_name}.png",
                    "svg_path": f"extracted/{icon_name}.svg",
                    "assigned_use": get_assigned_use(row, col)
                })
                
                print(f"✅ Extracted: {icon_name} (Row {row+1}, Col {col+1})")
        
        # Create icon registry
        registry_path = os.path.join(output_dir, "../icon-registry.json")
        with open(registry_path, 'w') as f:
            json.dump(extracted_icons, f, indent=2)
        
        print(f"\n🌌 Extracted {len(extracted_icons)} sacred geometry icons!")
        print(f"📁 Output directory: {output_dir}")
        print(f"📋 Registry: {registry_path}")
        
        return extracted_icons
        
    except Exception as e:
        print(f"❌ Error extracting icons: {str(e)}")
        return []

def get_icon_category(row):
    """Get category based on row"""
    categories = [
        "Metatrons Cube Family",
        "Metatrons Cube Family", 
        "Organic Patterns",
        "Energy Patterns",
        "Dimensional Geometry",
        "Dimensional Geometry"
    ]
    return categories[row]

def get_assigned_use(row, col):
    """Get assigned use based on position"""
    if row == 0 and col == 2:  # Center top
        return "AI Buddy button - Primary interaction"
    elif row == 4 and col == 0:  # Bottom left - WATERMARK
        return "Aurora watermark - Bottom left flowing animation"
    elif row < 2:  # Top rows
        return "Core AI nodes, HCFullPipeline stages"
    elif row == 2:  # Third row
        return "Data flow animations, organic transitions"
    elif row == 3:  # Fourth row
        return "Active processing states, sync indicators"
    else:  # Bottom rows
        return "Workspace layers, architectural hierarchy"

def create_simple_svg(png_path, svg_path, icon_name):
    """Create a simple SVG placeholder"""
    try:
        # Create a simple geometric SVG based on the icon name
        svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00D9FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8000FF;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="40" fill="url(#grad)" opacity="0.8"/>
  <text x="50" y="55" text-anchor="middle" fill="white" font-size="8">{icon_name[:8]}</text>
</svg>"""
        
        with open(svg_path, 'w') as f:
            f.write(svg_content)
            
    except Exception as e:
        print(f"Warning: Could not create SVG for {icon_name}: {str(e)}")

if __name__ == "__main__":
    print("🌌 Starting Sacred Geometry Icon Extraction...")
    icons = extract_sacred_icons()
    
    if icons:
        print("\n✅ Extraction complete!")
        print("🎨 Icons ready for Sacred Geometry branding system")
    else:
        print("\n❌ Extraction failed!")

"""
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
█▓▒░       🜃  Built with Sacred Geometry Principles  🜃        ░▒▓█
█▓▒░              ⟡  Maximum Global Happiness  ⟡               ░▒▓█
█▓▒░          🌌  Fractal Consciousness Architecture  🌌       ░▒▓█
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
"""
