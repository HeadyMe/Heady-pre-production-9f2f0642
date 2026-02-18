#!/usr/bin/env python3
"""
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
█▓▒░            🌌 SACRED GEOMETRY ICON EXTRACTOR 🌌           ░▒▓█
█▓▒░          Organic Systems • Breathing Interfaces           ░▒▓█
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█

FILE: icon-extraction-simple.py
LAYER: assets/sacred-geometry/icons
PURPOSE: Create 36 sacred geometry icons from grid image (PIL only)

🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
🌊 Maximum Global Happiness through AI-Powered Social Impact

█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
"""

from PIL import Image, ImageDraw, ImageFont
import os
import json

def create_sacred_icons():
    """Create the 36 sacred geometry icons programmatically"""
    
    # Create output directory
    output_dir = "/home/headyme/CascadeProjects/Heady/assets/sacred-geometry/icons/extracted"
    os.makedirs(output_dir, exist_ok=True)
    
    # Icon names based on visual analysis of the grid
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
    
    # Create each icon
    for row in range(6):
        for col in range(6):
            icon_name = icon_names[row][col]
            
            # Create icon based on category
            if row < 2:  # Metatron's Cube Family
                icon_img = create_metatrons_icon(icon_name, row, col)
            elif row == 2:  # Organic Patterns
                icon_img = create_organic_icon(icon_name, col)
            elif row == 3:  # Energy Patterns
                icon_img = create_energy_icon(icon_name, col)
            elif row == 4:  # Dimensional Geometry
                icon_img = create_dimensional_icon(icon_name, col)
            else:  # Row 5 - More Dimensional
                icon_img = create_dimensional_icon(icon_name, col)
            
            # Save as PNG
            icon_path = os.path.join(output_dir, f"{icon_name}.png")
            icon_img.save(icon_path, "PNG")
            
            # Create SVG version
            svg_path = os.path.join(output_dir, f"{icon_name}.svg")
            create_svg_icon(icon_path, svg_path, icon_name, row, col)
            
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
            
            print(f"✅ Created: {icon_name} (Row {row+1}, Col {col+1})")
    
    # Create icon registry
    registry_path = os.path.join(output_dir, "../icon-registry.json")
    with open(registry_path, 'w') as f:
        json.dump(extracted_icons, f, indent=2)
    
    print(f"\n🌌 Created {len(extracted_icons)} sacred geometry icons!")
    print(f"📁 Output directory: {output_dir}")
    print(f"📋 Registry: {registry_path}")
    
    return extracted_icons

def create_metatrons_icon(name, row, col):
    """Create Metatron's Cube family icons"""
    img = Image.new('RGBA', (100, 100), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Color gradients based on position
    colors = [
        (0, 217, 255),   # Sacred Cyan
        (0, 128, 255),   # Sacred Blue
        (128, 0, 255),   # Sacred Purple
    ]
    color = colors[col % len(colors)]
    
    # Draw interconnected nodes
    center_x, center_y = 50, 50
    nodes = []
    
    # Create node pattern
    for i in range(6):
        angle = i * 60
        x = center_x + int(25 * cos(angle))
        y = center_y + int(25 * sin(angle))
        nodes.append((x, y))
        draw.ellipse([x-4, y-4, x+4, y+4], fill=color + (255,))
    
    # Connect nodes
    for i, (x1, y1) in enumerate(nodes):
        for x2, y2 in nodes[i+1:]:
            draw.line([x1, y1, x2, y2], fill=color + (128,), width=1)
    
    # Center node
    draw.ellipse([center_x-6, center_y-6, center_x+6, center_y+6], fill=color + (255,))
    
    return img

def create_organic_icon(name, col):
    """Create organic pattern icons"""
    img = Image.new('RGBA', (100, 100), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Organic colors
    colors = [
        (255, 215, 0),   # Organic Gold
        (0, 255, 136),   # Organic Green
        (0, 255, 217),   # Organic Teal
    ]
    color = colors[col % len(colors)]
    
    if "yin-yang" in name:
        # Yin-yang pattern
        draw.ellipse([20, 20, 80, 80], fill=color + (200,))
        draw.ellipse([35, 20, 65, 50], fill=(255, 255, 255) + (200,))
        draw.ellipse([35, 50, 65, 80], fill=(0, 0, 0) + (200,))
        draw.ellipse([42, 35, 48, 41], fill=(0, 0, 0) + (255,))
        draw.ellipse([42, 59, 48, 65], fill=(255, 255, 255) + (255,))
    elif "flower" in name:
        # Flower of life pattern
        for i in range(6):
            angle = i * 60
            x = 50 + int(20 * cos(angle))
            y = 50 + int(20 * sin(angle))
            draw.ellipse([x-15, y-15, x+15, y+15], outline=color + (200,), width=2)
    elif "tree" in name:
        # Tree of life
        draw.rectangle([48, 60, 52, 80], fill=(139, 69, 19) + (255,))  # Trunk
        for i in range(3):
            y = 20 + i * 15
            draw.ellipse([50-20, y, 50+20, y+10], fill=color + (200,))
    elif "butterfly" in name:
        # Butterfly wings
        draw.ellipse([30, 40, 50, 60], fill=color + (200,))
        draw.ellipse([50, 40, 70, 60], fill=color + (200,))
        draw.rectangle([48, 45, 52, 55], fill=(100, 100, 100) + (255,))
    else:
        # Generic organic shape
        draw.ellipse([30, 30, 70, 70], fill=color + (200,), outline=color + (255,))
    
    return img

def create_energy_icon(name, col):
    """Create energy pattern icons"""
    img = Image.new('RGBA', (100, 100), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Energy rainbow colors
    colors = [
        (255, 0, 128),   # Energy Pink
        (255, 128, 0),   # Energy Orange
        (255, 255, 0),   # Energy Yellow
        (0, 255, 128),   # Energy Green
        (0, 128, 255),   # Energy Blue
        (128, 0, 255),   # Energy Purple
    ]
    color = colors[col % len(colors)]
    
    if "burst" in name:
        # Star burst
        points = []
        for i in range(10):
            angle = i * 36
            if i % 2 == 0:
                r = 35
            else:
                r = 15
            x = 50 + int(r * cos(angle))
            y = 50 + int(r * sin(angle))
            points.append((x, y))
        draw.polygon(points, fill=color + (200,))
    elif "spiral" in name:
        # Galaxy spiral
        for i in range(50):
            angle = i * 20
            r = i * 0.7
            x = 50 + int(r * cos(angle))
            y = 50 + int(r * sin(angle))
            draw.ellipse([x-2, y-2, x+2, y+2], fill=color + (255-i*4,))
    elif "waveform" in name:
        # Waveform
        points = []
        for x in range(20, 80):
            y = 50 + int(15 * sin((x - 20) * 0.3))
            points.append((x, y))
        for i in range(len(points)-1):
            draw.line([points[i], points[i+1]], fill=color + (200,), width=3)
    else:
        # Generic energy pattern
        for i in range(3):
            size = 30 - i * 8
            draw.ellipse([50-size, 50-size, 50+size, 50+size], 
                        outline=color + (200-i*50,), width=2)
    
    return img

def create_dimensional_icon(name, col):
    """Create dimensional geometry icons"""
    img = Image.new('RGBA', (100, 100), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Dimensional metallic colors
    colors = [
        (255, 215, 0),   # Dimension Gold
        (192, 192, 192), # Dimension Silver
        (205, 127, 50),  # Dimension Bronze
    ]
    color = colors[col % len(colors)]
    
    if "cube" in name:
        # 3D cube effect
        # Front face
        draw.rectangle([30, 30, 60, 60], fill=color + (200,), outline=color + (255,))
        # Top face
        draw.polygon([30, 30, 45, 15, 75, 15, 60, 30], fill=color + (150,))
        # Right face
        draw.polygon([60, 30, 75, 15, 75, 45, 60, 60], fill=color + (100,))
    elif "watermark" in name:
        # Aurora watermark - flowing pattern
        for i in range(5):
            y = 20 + i * 15
            width = 60 + i * 5
            x = 50 - width // 2
            draw.ellipse([x, y, x+width, y+10], fill=color + (50-i*8,))
    else:
        # Generic geometric shape
        draw.polygon([
            (50, 20), (70, 40), (70, 70), (50, 80), (30, 70), (30, 40)
        ], fill=color + (200,), outline=color + (255,))
    
    return img

def create_svg_icon(png_path, svg_path, icon_name, row, col):
    """Create SVG version of the icon"""
    
    # Get colors based on category
    if row < 2:  # Metatron's Cube Family
        gradient_colors = "#00D9FF, #8000FF"
    elif row == 2:  # Organic Patterns
        gradient_colors = "#FFD700, #00FF88"
    elif row == 3:  # Energy Patterns
        gradient_colors = "#FF0080, #00FF80"
    else:  # Dimensional Geometry
        gradient_colors = "#FFD700, #C0C0C0"
    
    # Create SVG content
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="grad-{icon_name}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{gradient_colors.split(',')[0]};stop-opacity:1" />
      <stop offset="100%" style="stop-color:{gradient_colors.split(',')[1]};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Sacred Geometry Icon: {icon_name} -->
  <!-- Row: {row+1}, Column: {col+1} -->
  <!-- Category: {get_icon_category(row)} -->
  
  <circle cx="50" cy="50" r="40" fill="url(#grad-{icon_name})" opacity="0.8"/>
  
  <!-- Icon-specific geometry -->
  {get_icon_geometry(icon_name)}
  
</svg>"""
    
    with open(svg_path, 'w') as f:
        f.write(svg_content)

def get_icon_geometry(icon_name):
    """Get specific geometry for each icon"""
    if "cube" in icon_name:
        return '<rect x="30" y="30" width="40" height="40" fill="white" opacity="0.3"/>'
    elif "star" in icon_name:
        return '<polygon points="50,20 60,40 80,40 65,55 70,75 50,65 30,75 35,55 20,40 40,40" fill="white" opacity="0.3"/>'
    elif "flower" in icon_name:
        return '<circle cx="50" cy="35" r="15" fill="none" stroke="white" stroke-width="2" opacity="0.5"/>'
    elif "tree" in icon_name:
        return '<rect x="48" y="40" width="4" height="30" fill="white" opacity="0.4"/>'
    elif "burst" in icon_name:
        return '<polygon points="50,25 55,40 70,40 58,50 63,65 50,55 37,65 42,50 30,40 45,40" fill="white" opacity="0.3"/>'
    elif "spiral" in icon_name:
        return '<path d="M50,50 Q60,40 50,30 T30,50" fill="none" stroke="white" stroke-width="2" opacity="0.5"/>'
    elif "waveform" in icon_name:
        return '<path d="M20,50 Q35,30 50,50 T80,50" fill="none" stroke="white" stroke-width="3" opacity="0.5"/>'
    elif "watermark" in icon_name:
        return '<ellipse cx="50" cy="50" rx="35" ry="20" fill="white" opacity="0.2"/>'
    else:
        return '<circle cx="50" cy="50" r="20" fill="white" opacity="0.3"/>'

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

# Helper function for trigonometry
import math
def cos(angle):
    return math.cos(math.radians(angle))

def sin(angle):
    return math.sin(math.radians(angle))

if __name__ == "__main__":
    print("🌌 Starting Sacred Geometry Icon Creation...")
    icons = create_sacred_icons()
    
    if icons:
        print("\n✅ Icon creation complete!")
        print("🎨 Sacred Geometry icons ready for branding system")
        
        # Show watermark icon specifically
        watermark_icon = next((icon for icon in icons if icon["name"] == "aurora-watermark"), None)
        if watermark_icon:
            print(f"\n🌊 Aurora Watermark Icon: {watermark_icon['svg_path']}")
            print("   Use this for bottom-left flowing animation")
    else:
        print("\n❌ Icon creation failed!")

"""
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
█▓▒░       🜃  Built with Sacred Geometry Principles  🜃        ░▒▓█
█▓▒░              ⟡  Maximum Global Happiness  ⟡               ░▒▓█
█▓▒░          🌌  Fractal Consciousness Architecture  🌌       ░▒▓█
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
"""
