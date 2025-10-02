// Preference management functions
async function savePreferences(preferences) {
  try {
    await chrome.storage.local.set({ preferences });
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
}

async function loadPreferences() {
  try {
    const result = await chrome.storage.local.get(['preferences']);
    return result.preferences || {
      matchMode: 'host',
      viewMode: 'duplicates',
      windowOverviewExpanded: true
    };
  } catch (error) {
    console.error('Error loading preferences:', error);
    return {
      matchMode: 'host',
      viewMode: 'duplicates',
      windowOverviewExpanded: true
    };
  }
}

async function applyPreferences(preferences) {
  // Apply match mode
  const modeSelect = document.getElementById('mode');
  if (modeSelect && preferences.matchMode) {
    modeSelect.value = preferences.matchMode;
  }
  
  // Apply view mode
  const viewModeSelect = document.getElementById('viewMode');
  if (viewModeSelect && preferences.viewMode) {
    viewModeSelect.value = preferences.viewMode;
  }
  
  // Apply window overview expanded state
  const windowOverviewSection = document.getElementById('windowOverviewSection');
  if (windowOverviewSection && preferences.windowOverviewExpanded !== undefined) {
    if (preferences.windowOverviewExpanded) {
      windowOverviewSection.classList.add('expanded');
    } else {
      windowOverviewSection.classList.remove('expanded');
    }
  }
}

// Helper function to get favicon URL from a tab URL
function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    // Try common favicon paths
    return `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
  } catch {
    return null;
  }
}

// Helper function to truncate URLs for display
function truncateUrl(url, maxLength = 60) {
  if (!url || url === '(chrome-internal)') return url;
  if (url.length <= maxLength) return url;
  
  // Try to keep the domain visible and truncate the path
  try {
    const urlObj = new URL(url);
    const domain = urlObj.host;
    const path = urlObj.pathname + urlObj.search + urlObj.hash;
    
    if (domain.length >= maxLength - 10) {
      // Domain is too long, just truncate the whole URL
      return url.substring(0, maxLength - 3) + '...';
    }
    
    const remainingLength = maxLength - domain.length - 7; // 7 for protocol + "://"
    if (path.length <= remainingLength) {
      return url; // No truncation needed
    }
    
    const truncatedPath = path.substring(0, remainingLength - 3) + '...';
    return `${urlObj.protocol}//${domain}${truncatedPath}`;
  } catch {
    // If URL parsing fails, just truncate the whole string
    return url.substring(0, maxLength - 3) + '...';
  }
}

// Canonicalize URLs so "duplicates" are defined the way you want.
function canonicalKey(u, mode) {
  try {
    const url = new URL(u);
    let host = url.host.toLowerCase();
    if (mode === 'host+path-no-www' && host.startsWith('www.')) host = host.slice(4);

    const path = url.pathname.replace(/\/+$/, ''); // strip trailing slash
    if (mode === 'host') return host;
    if (mode === 'host+path') return `${host}${path}`;
    if (mode === 'host+path-no-www') return `${host}${path}`;
    // host+path+qs (normalize query param order)
    const params = new URLSearchParams(url.search);
    const pairs = [];
    for (const [k, v] of params.entries()) pairs.push([k, v]);
    pairs.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const qs = pairs.map(([k, v]) => `${k}=${v}`).join('&');
    return `${host}${path}?${qs}`;
  } catch {
    return u;
  }
}

function render(groups, viewMode = 'duplicates') {
  const root = document.getElementById('root');
  root.innerHTML = '';

  // Update description based on view mode
  const description = document.getElementById('description');
  if (viewMode === 'all') {
    description.textContent = 'All tabs are grouped below. Click on a group to expand and see individual tabs.';
  } else {
    description.textContent = 'Duplicate tabs are grouped below. Click on a group to expand and see individual tabs.';
  }

  const keys = viewMode === 'all' 
    ? Object.keys(groups) 
    : Object.keys(groups).filter(k => groups[k].length > 1);
    
  if (keys.length === 0) {
    const emptyMessage = viewMode === 'all' 
      ? 'No tabs found.' 
      : 'No duplicates found under the current match mode.';
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✨</div>
        <div>${emptyMessage}</div>
      </div>
    `;
    return;
  }

  keys.sort((a, b) => groups[b].length - groups[a].length);

  for (const key of keys) {
    const tabs = groups[key];
    const group = document.createElement('div');
    group.className = 'group';

    // Group header
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    
    // Top row: URL with favicon
    const topRow = document.createElement('div');
    topRow.className = 'group-header-top-row';
    
    const groupUrl = document.createElement('div');
    groupUrl.className = 'group-url';
    const example = tabs[0];
    
    // Create favicon element
    const favicon = document.createElement('div');
    favicon.className = 'favicon';
    
    const faviconUrl = getFaviconUrl(example.url);
    if (faviconUrl) {
      const faviconImg = document.createElement('img');
      faviconImg.src = faviconUrl;
      faviconImg.alt = '';
      faviconImg.onerror = () => {
        // Fallback to first letter of hostname if favicon fails to load
        try {
          const urlObj = new URL(example.url);
          const hostname = urlObj.hostname.replace('www.', '');
          favicon.textContent = hostname.charAt(0).toUpperCase();
          faviconImg.remove();
        } catch {
          favicon.textContent = '?';
          faviconImg.remove();
        }
      };
      favicon.appendChild(faviconImg);
    } else {
      // Fallback for chrome-internal or invalid URLs
      favicon.textContent = example.url ? '?' : '🔧';
    }
    
    // Create URL text element
    const urlText = document.createElement('span');
    urlText.className = 'url-text';
    urlText.textContent = truncateUrl(example.url) || '(chrome-internal)';
    
    groupUrl.appendChild(favicon);
    groupUrl.appendChild(urlText);
    
    topRow.appendChild(groupUrl);
    
    // Bottom row: Tab count and action buttons
    const bottomRow = document.createElement('div');
    bottomRow.className = 'group-header-bottom-row';
    
    const groupMeta = document.createElement('div');
    groupMeta.className = 'group-meta';
    
    const groupCount = document.createElement('span');
    groupCount.className = 'group-count';
    groupCount.textContent = tabs.length;
    
    groupMeta.appendChild(groupCount);
    
    // Create action buttons for the header
    const headerActions = document.createElement('div');
    headerActions.className = 'group-header-actions';
    
    const switchToFirst = document.createElement('button');
    switchToFirst.className = 'btn header-action-btn';
    switchToFirst.textContent = 'Switch to first';
    switchToFirst.onclick = async (e) => {
      e.stopPropagation(); // Prevent group toggle
      const firstTab = tabs[0];
      await chrome.windows.update(firstTab.windowId, { focused: true });
      await chrome.tabs.update(firstTab.id, { active: true });
    };
    
    const closeAllButOne = document.createElement('button');
    closeAllButOne.className = 'btn primary header-action-btn';
    closeAllButOne.textContent = 'Keep first, close rest';
    closeAllButOne.onclick = async (e) => {
      e.stopPropagation(); // Prevent group toggle
      const survivors = tabs[0].id;
      const victims = tabs.slice(1).map(x => x.id);
      if (victims.length) await chrome.tabs.remove(victims);
      refresh();
    };

    const consolidateToCurrent = document.createElement('button');
    consolidateToCurrent.className = 'btn header-action-btn';
    consolidateToCurrent.textContent = 'Consolidate';
    consolidateToCurrent.onclick = async (e) => {
      e.stopPropagation(); // Prevent group toggle
      const [currTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currTab) return;
      const targetWin = currTab.windowId;
      const ids = tabs.filter(x => x.windowId !== targetWin).map(x => x.id);
      if (ids.length) await chrome.tabs.move(ids, { windowId: targetWin, index: -1 });
      await chrome.windows.update(targetWin, { focused: true });
      refresh();
    };

    const closeAll = document.createElement('button');
    closeAll.className = 'btn danger header-action-btn';
    closeAll.textContent = 'Close all';
    closeAll.onclick = async (e) => {
      e.stopPropagation(); // Prevent group toggle
      const ids = tabs.map(x => x.id);
      if (ids.length) await chrome.tabs.remove(ids);
      refresh();
    };

    headerActions.append(switchToFirst, closeAllButOne, consolidateToCurrent, closeAll);
    
    bottomRow.appendChild(groupMeta);
    bottomRow.appendChild(headerActions);
    
    const collapseIcon = document.createElement('div');
    collapseIcon.className = 'collapse-icon';
    collapseIcon.textContent = '▼';
    
    groupHeader.appendChild(topRow);
    groupHeader.appendChild(bottomRow);
    groupHeader.appendChild(collapseIcon);
    
    // Group content (collapsible)
    const groupContent = document.createElement('div');
    groupContent.className = 'group-content';
    
    // Individual tabs
    for (const t of tabs) {
      const tabItem = document.createElement('div');
      tabItem.className = 'tab-item';

      const tabInfo = document.createElement('div');
      tabInfo.className = 'tab-info';
      
      const tabUrl = document.createElement('div');
      tabUrl.className = 'tab-title';
      tabUrl.textContent = truncateUrl(t.url) || '(chrome-internal)';
      
      const tabTitle = document.createElement('div');
      tabTitle.style.fontSize = '12px';
      tabTitle.style.color = '#64748b';
      tabTitle.style.marginBottom = '4px';
      tabTitle.textContent = t.title || '(no title)';
      
      const tabMeta = document.createElement('div');
      tabMeta.className = 'tab-meta';
      tabMeta.innerHTML = `
        <span>Window ${t.windowId}, Tab ${t.id}</span>
        ${t.discarded ? '<span class="tab-status discarded">Discarded</span>' : ''}
      `;
      
      tabInfo.appendChild(tabUrl);
      tabInfo.appendChild(tabTitle);
      tabInfo.appendChild(tabMeta);

      const tabActions = document.createElement('div');
      tabActions.className = 'tab-actions';

      const jump = document.createElement('button');
      jump.className = 'btn primary';
      jump.textContent = 'Switch';
      jump.onclick = () => {
        chrome.windows.update(t.windowId, { focused: true });
        chrome.tabs.update(t.id, { active: true });
      };

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn';
      closeBtn.textContent = 'Close';
      closeBtn.onclick = async () => {
        await chrome.tabs.remove(t.id);
        refresh();
      };

      const keepOnlyThis = document.createElement('button');
      keepOnlyThis.className = 'btn';
      keepOnlyThis.textContent = 'Keep only this';
      keepOnlyThis.onclick = async () => {
        const others = tabs.filter(x => x.id !== t.id).map(x => x.id);
        if (others.length) await chrome.tabs.remove(others);
        refresh();
      };

      const consolidateHere = document.createElement('button');
      consolidateHere.className = 'btn';
      consolidateHere.textContent = 'Consolidate here';
      consolidateHere.onclick = async () => {
        const targetWin = t.windowId;
        const otherTabs = tabs.filter(x => x.windowId !== targetWin).map(x => x.id);
        if (otherTabs.length) await chrome.tabs.move(otherTabs, { windowId: targetWin, index: -1 });
        await chrome.windows.update(targetWin, { focused: true });
        refresh();
      };

      tabActions.append(jump, closeBtn, keepOnlyThis, consolidateHere);
      tabItem.append(tabInfo, tabActions);
      groupContent.appendChild(tabItem);
    }


    // Toggle functionality
    groupHeader.onclick = () => {
      group.classList.toggle('expanded');
    };

    group.appendChild(groupHeader);
    group.appendChild(groupContent);
    root.appendChild(group);
  }
}

// Get unique windows and their tab counts
async function getWindowData() {
  try {
    const allTabs = await chrome.tabs.query({});
    const currentWindow = await chrome.windows.getCurrent();
    
    const windowMap = new Map();
    
    for (const tab of allTabs) {
      // Skip special pages
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) continue;
      
      if (!windowMap.has(tab.windowId)) {
        windowMap.set(tab.windowId, {
          windowId: tab.windowId,
          tabCount: 0,
          isCurrent: tab.windowId === currentWindow.id
        });
      }
      windowMap.get(tab.windowId).tabCount++;
    }
    
    return Array.from(windowMap.values()).sort((a, b) => {
      // Current window first, then by window ID
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return a.windowId - b.windowId;
    });
  } catch (error) {
    console.error('Error getting window data:', error);
    return [];
  }
}

// Render window overview
function renderWindowOverview(windows) {
  const windowGrid = document.getElementById('windowGrid');
  windowGrid.innerHTML = '';
  
  if (windows.length === 0) {
    windowGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 20px;">No windows found</div>';
    return;
  }
  
  for (const window of windows) {
    const windowSquare = document.createElement('div');
    windowSquare.className = `window-square ${window.isCurrent ? 'current' : ''}`;
    windowSquare.draggable = true;
    windowSquare.dataset.windowId = window.windowId;
    windowSquare.innerHTML = `
      <div class="window-tab-count">${window.tabCount}</div>
    `;
    
    // Drag and drop event handlers
    windowSquare.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', window.windowId.toString());
      e.dataTransfer.effectAllowed = 'move';
      windowSquare.classList.add('dragging');
      
      // Add visual feedback to all other windows as potential drop targets
      document.querySelectorAll('.window-square').forEach(square => {
        if (square !== windowSquare) {
          square.classList.add('drop-target');
        }
      });
    });
    
    windowSquare.addEventListener('dragend', (e) => {
      windowSquare.classList.remove('dragging');
      document.querySelectorAll('.window-square').forEach(square => {
        square.classList.remove('drop-target', 'drag-over');
      });
    });
    
    windowSquare.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      windowSquare.classList.add('drag-over');
    });
    
    windowSquare.addEventListener('dragleave', (e) => {
      windowSquare.classList.remove('drag-over');
    });
    
    windowSquare.addEventListener('drop', async (e) => {
      e.preventDefault();
      const sourceWindowId = parseInt(e.dataTransfer.getData('text/plain'));
      const targetWindowId = parseInt(windowSquare.dataset.windowId);
      
      if (sourceWindowId !== targetWindowId) {
        try {
          // Get all tabs from the source window
          const sourceTabs = await chrome.tabs.query({ windowId: sourceWindowId });
          const tabsToMove = sourceTabs.filter(tab => 
            tab.url && 
            !tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('edge://')
          );
          
          if (tabsToMove.length > 0) {
            // Move all tabs to the target window
            const tabIds = tabsToMove.map(tab => tab.id);
            await chrome.tabs.move(tabIds, { windowId: targetWindowId, index: -1 });
            
            // Focus the target window
            await chrome.windows.update(targetWindowId, { focused: true });
            
            // Refresh the display
            refresh();
          }
        } catch (error) {
          console.error('Error consolidating windows:', error);
        }
      }
      
      windowSquare.classList.remove('drag-over');
    });
    
    windowSquare.onclick = async () => {
      // Just refresh to update the display - don't focus the window to avoid closing popup
      refresh();
    };
    
    // Double-click to actually focus the window (this will close the popup, which is expected)
    windowSquare.ondblclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await chrome.windows.update(window.windowId, { focused: true });
    };
    
    windowGrid.appendChild(windowSquare);
  }
}

async function refresh() {
  try {
    const mode = document.getElementById('mode').value;
    const viewMode = document.getElementById('viewMode').value;
    const allTabs = await chrome.tabs.query({});
    const groups = {};
    for (const t of allTabs) {
      // Skip special pages that don't have normal URLs if you like:
      if (!t.url || t.url.startsWith('chrome://') || t.url.startsWith('edge://')) continue;
      const key = canonicalKey(t.url, mode);
      (groups[key] ||= []).push(t);
    }
    
    // Render window overview
    const windows = await getWindowData();
    renderWindowOverview(windows);
    
    render(groups, viewMode);
  } catch (error) {
    console.error('Error in refresh:', error);
    // Show error in the root element
    const root = document.getElementById('root');
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div>Error loading tabs: ${error.message}</div>
      </div>
    `;
  }
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  // Load and apply saved preferences
  const preferences = await loadPreferences();
  await applyPreferences(preferences);
  
  document.getElementById('mode').addEventListener('change', async () => {
    const preferences = await loadPreferences();
    preferences.matchMode = document.getElementById('mode').value;
    await savePreferences(preferences);
    refresh();
  });
  
  document.getElementById('viewMode').addEventListener('change', async () => {
    const preferences = await loadPreferences();
    preferences.viewMode = document.getElementById('viewMode').value;
    await savePreferences(preferences);
    refresh();
  });

  // Add window overview collapse functionality
  const windowOverviewToggle = document.getElementById('windowOverviewToggle');
  const windowOverviewSection = document.getElementById('windowOverviewSection');
  const windowOverviewHeader = document.querySelector('.window-overview-header');
  
  const toggleWindowOverview = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    windowOverviewSection.classList.toggle('expanded');
    const isExpanded = windowOverviewSection.classList.contains('expanded');
    console.log('Window overview toggled, expanded:', isExpanded);
    
    // Save the expanded state
    const preferences = await loadPreferences();
    preferences.windowOverviewExpanded = isExpanded;
    await savePreferences(preferences);
  };
  
  windowOverviewToggle.addEventListener('click', toggleWindowOverview);
  windowOverviewHeader.addEventListener('click', toggleWindowOverview);

  // Add consolidate all functionality
  document.getElementById('consolidateAllBtn').addEventListener('click', async () => {
  try {
    const [currTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!currTab) return;
    
    const targetWin = currTab.windowId;
    const allTabs = await chrome.tabs.query({});
    const tabsToMove = allTabs.filter(tab => 
      tab.windowId !== targetWin && 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('edge://')
    );
    
    if (tabsToMove.length === 0) {
      alert('No tabs to consolidate!');
      return;
    }
    
    const tabIds = tabsToMove.map(tab => tab.id);
    await chrome.tabs.move(tabIds, { windowId: targetWin, index: -1 });
    await chrome.windows.update(targetWin, { focused: true });
    refresh();
  } catch (error) {
    console.error('Error consolidating tabs:', error);
    alert('Error consolidating tabs. Please try again.');
  }
  });

  // Initial refresh
  refresh();

  // Add listeners for tab changes and closures to auto-refresh the popup
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Refresh when tab URL, title, or status changes
    if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
      refresh();
    }
  });

  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // Refresh when any tab is closed
    refresh();
  });

  chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
    // Refresh when tabs are moved between windows
    refresh();
  });

  chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
    // Refresh when tabs are attached to a window
    refresh();
  });

  chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
    // Refresh when tabs are detached from a window
    refresh();
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    // Refresh when window focus changes
    refresh();
  });

  chrome.windows.onRemoved.addListener((windowId) => {
    // Refresh when a window is closed
    refresh();
  });
});
