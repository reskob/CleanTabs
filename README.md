# CleanTabs

A powerful browser extension that helps you manage duplicate tabs across all browser windows. CleanTabs finds duplicate tabs and provides intuitive tools to consolidate, close, or organize them efficiently.

## Features

- **🔍 Smart Duplicate Detection**: Finds duplicate tabs across all browser windows with flexible matching modes
- **📊 Visual Window Overview**: See all your windows at a glance with tab counts
- **🎯 Multiple Match Modes**: 
  - Host only (same domain)
  - Host + path (same domain and path)
  - Host + path + query (exact URL match)
  - Host + path (strip www)
- **⚡ Quick Actions**: 
  - Switch to any tab instantly
  - Close duplicates while keeping one
  - Consolidate tabs to current window
  - Drag & drop window consolidation

## What It Does

CleanTabs scans all your browser windows and identifies duplicate tabs based on your chosen matching criteria. It then presents them in an organized, collapsible interface where you can:

- **View duplicates grouped by URL** with favicons and metadata
- **Quickly switch between duplicate tabs** across different windows
- **Close redundant tabs** while keeping the ones you want
- **Consolidate all tabs** into a single window for better organization
- **Drag and drop windows** to merge all tabs from one window into another
- **See a visual overview** of all your windows and their tab counts

## Installation

### Method 1: Load as Unpacked Extension (Recommended for Development)

1. **Download or Clone** this repository to your local machine
2. **Open Chrome/Edge** and navigate to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top-right corner
4. **Click "Load unpacked"** and select the folder containing the extension files
5. **Pin the extension** to your toolbar for easy access

### Method 2: Manual Installation

1. Download the extension files (`manifest.json`, `popup.html`, `popup.js`)
2. Create a new folder and place all files in it
3. Follow steps 2-5 from Method 1

## Usage

### Getting Started

1. **Click the CleanTabs icon** in your browser toolbar
2. **Choose your match mode**:
   - **Host only**: Groups tabs by domain (e.g., all google.com tabs)
   - **Host + path**: Groups by domain and path (e.g., all google.com/search tabs)
   - **Host + path + query**: Exact URL matching including parameters
   - **Host + path (strip www)**: Treats www.example.com same as example.com

3. **Select view mode**:
   - **Duplicates only**: Shows only groups with multiple tabs
   - **All tabs**: Shows all tabs grouped by URL

### Managing Duplicates

#### Group Actions (Header Buttons)
- **Switch to first**: Focuses the first tab in the group
- **Keep first, close rest**: Closes all duplicates except the first one
- **Consolidate**: Moves all tabs in the group to your current window
- **Close all**: Closes all tabs in the group

#### Individual Tab Actions
- **Switch**: Jump to that specific tab
- **Close**: Close just that tab
- **Keep only this**: Close all other tabs in the group except this one
- **Consolidate here**: Move all other tabs in the group to this tab's window

#### Window Management
- **Window Overview**: Visual grid showing all windows with tab counts
- **Drag & Drop**: Drag any window square onto another to consolidate all tabs
- **Consolidate All**: Button to move all tabs from all windows to the current window

### Tips for Best Results

1. **Start with "Host only" mode** to see broad duplicate patterns
2. **Use "Host + path" mode** for more precise duplicate detection
3. **Check the Window Overview** to understand your tab distribution
4. **Use "Consolidate" actions** to organize tabs without losing them
5. **Pin important tabs** before using bulk close actions

## Permissions

CleanTabs requires the following permissions:

- **`tabs`**: To read tab information and manage tabs
- **`tabGroups`**: To work with tab groups (future feature)
- **`windows`**: To manage browser windows
- **`storage`**: To save your preferences
- **`<all_urls>`**: To access tab URLs for duplicate detection

These permissions are necessary for the extension to function properly and are used only for the features described above.

## Browser Compatibility

- ✅ **Chrome** (Manifest V3)
- ✅ **Microsoft Edge** (Chromium-based)
- ✅ **Other Chromium-based browsers**

## Privacy

CleanTabs operates entirely locally within your browser. It does not:
- Send any data to external servers
- Store your browsing history
- Track your activity
- Require internet connection (except for favicon loading)

All tab analysis and management happens locally using the browser's built-in APIs.

## Troubleshooting

### Extension Not Working
1. Ensure you're using a supported browser (Chrome/Edge)
2. Check that Developer Mode is enabled
3. Try reloading the extension from the extensions page
4. Refresh the extension popup

### No Duplicates Found
1. Try different match modes (Host only vs Host + path)
2. Check that you have tabs open in multiple windows
3. Ensure tabs aren't on special pages (chrome://, edge://)

### Performance Issues
1. Close unused browser windows to reduce tab count
2. Use "Duplicates only" view mode for faster loading
3. Consider closing very old tabs that may be consuming memory

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for better tab management**
