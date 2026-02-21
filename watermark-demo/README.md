# HeadySystems Animated Watermark

A beautiful, slowly moving and flowing watermark with gradual color changes for webpages.

## Features

- 🌟 **Slow Floating Animation**: Gentle floating movement across the screen
- 🎨 **Gradual Color Changes**: Smooth color transitions between gold, blue, and purple
- 🔄 **Continuous Rotation**: Very slow 360-degree rotation
- 💫 **Pulse & Breathe Effects**: Subtle scaling and opacity animations
- ✨ **Glow Effects**: Soft drop shadow that changes colors
- 📱 **Responsive Design**: Adapts to different screen sizes
- 🌙 **Dark Mode Support**: Optimized for both light and dark themes
- 🖨️ **Print Friendly**: Automatically hidden when printing

## Animation Details

### Timing & Duration
- **Float Animation**: 20 seconds (ease-in-out, infinite)
- **Rotation**: 30 seconds (linear, infinite) 
- **Color Shift**: 15 seconds (linear, infinite)
- **Pulse**: 8 seconds (ease-in-out, infinite)
- **Breathe**: 6 seconds (ease-in-out, infinite)

### Color Palette
- **Gold**: #FFD700 (HeadySystems primary)
- **Royal Blue**: #4169E1 (HeadyConnection primary)
- **Medium Purple**: #9370DB (Cosmic accent)

## Usage

### Basic Implementation
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <link rel="stylesheet" href="watermark.css">
</head>
<body>
    <!-- Your page content here -->
    
    <!-- Watermark -->
    <div class="watermark-container">
        <div class="watermark">
            <div class="watermark-logo">
                <!-- SVG content from index.html -->
            </div>
        </div>
    </div>
</body>
</html>
```

### Alternative Positions

#### Top Right Corner
```html
<div class="watermark-container">
    <div class="watermark top-right">
        <!-- SVG content -->
    </div>
</div>
```

#### Bottom Left Corner
```html
<div class="watermark-container">
    <div class="watermark bottom-left">
        <!-- SVG content -->
    </div>
</div>
```

### Customization

#### Adjust Opacity
```css
.watermark {
    opacity: 0.2; /* Default is 0.15 */
}
```

#### Change Animation Speed
```css
.watermark {
    animation-duration: 40s, 60s, 16s, 30s; /* Slower animations */
}
```

#### Modify Colors
```css
@keyframes colorShiftAnimation {
    0% { filter: hue-rotate(0deg); }
    100% { filter: hue-rotate(180deg); } /* Less rotation */
}
```

## File Structure

```
watermark-demo/
├── index.html          # Demo page with watermark
├── watermark.css       # All animation styles
└── README.md          # This documentation
```

## Browser Compatibility

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ⚠️ IE 11 (limited support)

## Performance Notes

- Uses CSS animations (GPU accelerated)
- Minimal JavaScript required
- `pointer-events: none` for no interaction interference
- Optimized for 60fps animations

## Customization Options

### Size Variations
```css
.watermark.small {
    width: 150px;
    height: 75px;
}

.watermark.large {
    width: 400px;
    height: 200px;
}
```

### Animation Intensity
```css
.watermark.subtle {
    opacity: 0.08;
    animation-duration: 40s, 60s, 20s, 40s;
}

.watermark.prominent {
    opacity: 0.25;
    animation-duration: 15s, 20s, 6s, 10s;
}
```

### Color Themes
```css
.watermark.ocean-theme {
    --color1: #006994;
    --color2: #00A8E8;
    --color3: #00C9FF;
}

.watermark.sunset-theme {
    --color1: #FF6B35;
    --color2: #F77B71;
    --color3: #FFB5B5;
}
```

## Integration Tips

1. **Load CSS Early**: Include watermark.css in your `<head>` for smooth loading
2. **Position Last**: Place watermark HTML at the end of `<body>` for proper stacking
3. **Test Performance**: Monitor frame rate on slower devices
4. **Consider Accessibility**: Ensure watermark doesn't interfere with readability

## Demo

Open `index.html` in your browser to see the animated watermark in action. The demo includes sample content to show how the watermark behaves with real page content.

## License

This watermark implementation is part of the HeadySystems ecosystem and follows the same licensing terms as the main project.
