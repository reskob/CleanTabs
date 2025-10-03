# CleanTabs Extension Icons

This directory contains the icon files for the CleanTabs Chrome extension.

## Icon Requirements

Chrome extensions need icons in the following sizes:
- **16x16px**: Used in the extension management page and context menus
- **48x48px**: Used in the extension management page
- **128x128px**: Used during installation and in the Chrome Web Store

## Current Files

- `cleantabs-logo.svg` - Full detailed logo design
- `cleantabs-logo-simple.svg` - Simplified version for smaller sizes
- `README.md` - This file

## Converting SVG to PNG

You need to convert the SVG files to PNG format in the required sizes. Here are several methods:

### Method 1: Online Converter
1. Go to https://convertio.co/svg-png/ or https://cloudconvert.com/svg-to-png
2. Upload the SVG file
3. Set the output size (16x16, 48x48, or 128x128)
4. Download the PNG file
5. Rename to `icon16.png`, `icon48.png`, or `icon128.png`

### Method 2: Using Inkscape (Free)
```bash
# Install Inkscape first, then:
inkscape --export-type=png --export-width=16 --export-height=16 cleantabs-logo-simple.svg --export-filename=icon16.png
inkscape --export-type=png --export-width=48 --export-height=48 cleantabs-logo-simple.svg --export-filename=icon48.png
inkscape --export-type=png --export-width=128 --export-height=128 cleantabs-logo.svg --export-filename=icon128.png
```

### Method 3: Using ImageMagick
```bash
# Install ImageMagick first, then:
magick cleantabs-logo-simple.svg -resize 16x16 icon16.png
magick cleantabs-logo-simple.svg -resize 48x48 icon48.png
magick cleantabs-logo.svg -resize 128x128 icon128.png
```

## Logo Design

The CleanTabs logo features:
- **Blue circular background** (#4A90E2) representing trust and organization
- **White "T" shape** representing "Tabs"
- **Gold sparkle** (#FFD700) representing the "clean" action
- **Simple, recognizable design** that works at all sizes

## Next Steps

1. Convert the SVG files to PNG using one of the methods above
2. Place the PNG files in this directory
3. Test your extension to ensure the icons display correctly
4. Consider creating additional sizes (32x32, 96x96) for better compatibility
