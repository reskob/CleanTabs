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

// Review tracking functions
async function saveReviewData(reviewData) {
  try {
    await chrome.storage.local.set({ reviewData });
  } catch (error) {
    console.error('Error saving review data:', error);
  }
}

async function loadReviewData() {
  try {
    const result = await chrome.storage.local.get(['reviewData']);
    return result.reviewData || {
      successfulActions: 0,
      lastReviewPrompt: null,
      reviewDismissed: false,
      reviewGiven: false,
      reviewDisabled: false
    };
  } catch (error) {
    console.error('Error loading review data:', error);
    return {
      successfulActions: 0,
      lastReviewPrompt: null,
      reviewDismissed: false,
      reviewGiven: false,
      reviewDisabled: false
    };
  }
}

// Track successful actions (tab consolidations)
async function trackSuccessfulAction() {
  const reviewData = await loadReviewData();
  reviewData.successfulActions += 1;
  await saveReviewData(reviewData);
  
  // Show review prompt after 5 successful actions and if not already dismissed/given/disabled
  if (reviewData.successfulActions >= 5 && !reviewData.reviewDismissed && !reviewData.reviewGiven && !reviewData.reviewDisabled) {
    const daysSinceLastPrompt = reviewData.lastReviewPrompt 
      ? (Date.now() - reviewData.lastReviewPrompt) / (1000 * 60 * 60 * 24)
      : 999;
    
    // Only show prompt if it's been at least 7 days since last prompt
    if (daysSinceLastPrompt >= 7) {
      showReviewPopup();
      reviewData.lastReviewPrompt = Date.now();
      await saveReviewData(reviewData);
    }
  }
}

// Show the review popup
function showReviewPopup() {
  const popup = document.getElementById('reviewPopup');
  if (popup) {
    popup.style.display = 'flex';
  }
}

// Hide the review popup
function hideReviewPopup() {
  const popup = document.getElementById('reviewPopup');
  if (popup) {
    popup.style.display = 'none';
  }
}

// Open Chrome Web Store review page
async function openReviewPage() {
  // Get the extension ID
  const extensionId = chrome.runtime.id;
  const reviewUrl = `https://chrome.google.com/webstore/detail/${extensionId}/reviews`;
  
  // Open in new tab
  await chrome.tabs.create({ url: reviewUrl });
  
  // Mark review as given
  const reviewData = await loadReviewData();
  reviewData.reviewGiven = true;
  await saveReviewData(reviewData);
  
  hideReviewPopup();
}

async function applyPreferences(preferences) {
  // Apply match mode
  const modeSelect = document.getElementById('mode');
  const matchModeSelect = document.getElementById('matchModeSelect');
  if (modeSelect && preferences.matchMode) {
    modeSelect.value = preferences.matchMode;
  }
  if (matchModeSelect && preferences.matchMode) {
    matchModeSelect.value = preferences.matchMode;
  }
  
  // Apply view mode
  const viewModeSelect = document.getElementById('viewMode');
  if (viewModeSelect && preferences.viewMode) {
    viewModeSelect.value = preferences.viewMode;
  }
  
  // Apply window overview expanded state
  const windowOverviewSection = document.getElementById('windowOverviewSection');
  if (windowOverviewSection && preferences.windowOverviewExpanded !== undefined) {
    // Temporarily disable transition for initial state application
    const windowOverviewContent = windowOverviewSection.querySelector('.window-overview-content');
    if (windowOverviewContent) {
      windowOverviewContent.style.transition = 'none';
    }
    
    if (preferences.windowOverviewExpanded) {
      windowOverviewSection.classList.add('expanded');
    } else {
      windowOverviewSection.classList.remove('expanded');
    }
    
    // Re-enable transition after a short delay
    setTimeout(() => {
      if (windowOverviewContent) {
        windowOverviewContent.style.transition = '';
      }
    }, 50);
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

function render(groups, viewMode = 'duplicates', searchTerm = '') {
  const root = document.getElementById('root');
  root.innerHTML = '';

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
  
  // Normalize search term for case-insensitive matching
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();

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
    
    // Create favicon element
    const favicon = document.createElement('div');
    favicon.className = 'favicon';
    const example = tabs[0];
    
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
    
    // Create URL text element - show the canonical key (match mode representation)
    const groupUrl = document.createElement('div');
    groupUrl.className = 'group-url';
    const matchMode = document.getElementById('mode').value;
    const canonicalUrl = canonicalKey(example.url, matchMode);
    groupUrl.textContent = truncateUrl(canonicalUrl) || '(chrome-internal)';
    
    topRow.appendChild(favicon);
    topRow.appendChild(groupUrl);
    
    // Bottom row: Tab count and action buttons
    const bottomRow = document.createElement('div');
    bottomRow.className = 'group-header-bottom-row';
    
    // Create count badge
    const groupCount = document.createElement('span');
    groupCount.className = 'group-count';
    groupCount.textContent = tabs.length;
    
    // Create action buttons for the header
    const headerActions = document.createElement('div');
    headerActions.className = 'group-header-actions btn-group';
    
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
    closeAllButOne.textContent = 'Keep first, close...';
    closeAllButOne.onclick = async (e) => {
      e.stopPropagation(); // Prevent group toggle
      const survivors = tabs[0].id;
      const victims = tabs.slice(1).map(x => x.id);
      if (victims.length) {
        await chrome.tabs.remove(victims);
        // Track successful action for review prompting
        await trackSuccessfulAction();
      }
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
      if (ids.length) {
        await chrome.tabs.move(ids, { windowId: targetWin, index: -1 });
        // Track successful action for review prompting
        await trackSuccessfulAction();
      }
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
    
    bottomRow.appendChild(groupCount);
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
    
    // Track if any tabs match the search term
    let hasMatchingTabs = false;
    
    // Individual tabs
    for (const t of tabs) {
      // Check if tab matches search term
      const tabMatchesSearch = !normalizedSearchTerm || 
        (t.title && t.title.toLowerCase().includes(normalizedSearchTerm)) ||
        (t.url && t.url.toLowerCase().includes(normalizedSearchTerm));
      
      // Track if any tab in this group matches
      if (tabMatchesSearch) {
        hasMatchingTabs = true;
      }
      
      const tabItem = document.createElement('div');
      tabItem.className = 'tab-item';
      
      // Hide tab item if it doesn't match search
      if (!tabMatchesSearch) {
        tabItem.classList.add('hidden');
      }

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
        ${t.discarded ? '<span class="tab-status discarded">Discarded</span>' : ''}
      `;
      
      tabInfo.appendChild(tabUrl);
      tabInfo.appendChild(tabTitle);
      tabInfo.appendChild(tabMeta);

      const tabActions = document.createElement('div');
      tabActions.className = 'tab-actions btn-group';

      const jump = document.createElement('button');
      jump.className = 'btn';
      jump.textContent = 'Switch';
      jump.onclick = () => {
        chrome.windows.update(t.windowId, { focused: true });
        chrome.tabs.update(t.id, { active: true });
      };

      const keepOnlyThis = document.createElement('button');
      keepOnlyThis.className = 'btn primary';
      keepOnlyThis.textContent = 'Keep only this';
      keepOnlyThis.onclick = async () => {
        const others = tabs.filter(x => x.id !== t.id).map(x => x.id);
        if (others.length) {
          await chrome.tabs.remove(others);
          // Track successful action for review prompting
          await trackSuccessfulAction();
        }
        refresh();
      };

      const consolidateHere = document.createElement('button');
      consolidateHere.className = 'btn';
      consolidateHere.textContent = 'Consolidate here';
      consolidateHere.onclick = async () => {
        const targetWin = t.windowId;
        const otherTabs = tabs.filter(x => x.windowId !== targetWin).map(x => x.id);
        if (otherTabs.length) {
          await chrome.tabs.move(otherTabs, { windowId: targetWin, index: -1 });
          // Track successful action for review prompting
          await trackSuccessfulAction();
        }
        await chrome.windows.update(targetWin, { focused: true });
        refresh();
      };

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn danger';
      closeBtn.textContent = 'Close';
      closeBtn.onclick = async () => {
        await chrome.tabs.remove(t.id);
        refresh();
      };

      tabActions.append(jump, keepOnlyThis, consolidateHere, closeBtn);
      tabItem.append(tabInfo, tabActions);
      groupContent.appendChild(tabItem);
    }


    // Toggle functionality
    groupHeader.onclick = () => {
      group.classList.toggle('expanded');
    };

    group.appendChild(groupHeader);
    group.appendChild(groupContent);
    
    // Hide entire group if no tabs match the search
    if (!hasMatchingTabs) {
      group.classList.add('hidden');
    }
    
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

// Get tabs for a specific window
async function getTabsForWindow(windowId) {
  try {
    const allTabs = await chrome.tabs.query({ windowId });
    // Filter out special pages
    return allTabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('edge://')
    );
  } catch (error) {
    console.error('Error getting tabs for window:', error);
    return [];
  }
}

// Generate favicon grid for a window
async function generateFaviconGrid(windowId) {
  try {
    const tabs = await getTabsForWindow(windowId);
    
    // Group tabs by host to avoid duplicate favicons
    const hostGroups = {};
    tabs.forEach(tab => {
      try {
        const urlObj = new URL(tab.url);
        const host = urlObj.host.toLowerCase();
        if (!hostGroups[host]) {
          hostGroups[host] = {
            host: host,
            faviconUrl: getFaviconUrl(tab.url),
            count: 0
          };
        }
        hostGroups[host].count++;
      } catch {
        // Handle invalid URLs
        const fallbackHost = 'chrome-internal';
        if (!hostGroups[fallbackHost]) {
          hostGroups[fallbackHost] = {
            host: fallbackHost,
            faviconUrl: null,
            count: 0
          };
        }
        hostGroups[fallbackHost].count++;
      }
    });
    
    // Sort hosts by tab count (most tabs first) and limit to 4 favicons
    const sortedHosts = Object.values(hostGroups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    
    if (sortedHosts.length === 0) {
      return null;
    }
    
    const faviconGrid = document.createElement('div');
    faviconGrid.className = 'window-favicon-grid';
    
    sortedHosts.forEach(hostGroup => {
      const faviconElement = document.createElement('div');
      faviconElement.className = 'window-favicon';
      
      // Set fallback letter as text content
      const hostname = hostGroup.host.replace('www.', '');
      const fallbackText = hostGroup.host === 'chrome-internal' ? '🔧' : hostname.charAt(0).toUpperCase();
      faviconElement.textContent = fallbackText;
      
      if (hostGroup.faviconUrl) {
        const faviconImg = document.createElement('img');
        faviconImg.src = hostGroup.faviconUrl;
        faviconImg.alt = '';
        faviconImg.onerror = () => {
          // Image failed to load, keep the text fallback
          faviconImg.remove();
        };
        faviconImg.onload = () => {
          // Image loaded successfully, clear the text
          faviconElement.textContent = '';
          faviconElement.appendChild(faviconImg);
        };
        // Don't append yet - will be appended on successful load
      }
      
      faviconGrid.appendChild(faviconElement);
    });
    
    return faviconGrid;
  } catch (error) {
    console.error('Error generating favicon grid:', error);
    return null;
  }
}

// Create and show window popup
function showWindowPopup(windowSquare, windowId, tabCount) {
  // Remove any existing popup
  const existingPopup = document.querySelector('.window-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create popup element
  const popup = document.createElement('div');
  popup.className = 'window-popup';
  popup.id = 'windowPopup';
  
  // Add to body
  document.body.appendChild(popup);
  
  // Get tabs for this window
  getTabsForWindow(windowId).then(tabs => {
    // Group tabs by host
    const hostGroups = {};
    tabs.forEach(tab => {
      try {
        const urlObj = new URL(tab.url);
        const host = urlObj.host.toLowerCase();
        if (!hostGroups[host]) {
          hostGroups[host] = {
            host: host,
            count: 0,
            faviconUrl: getFaviconUrl(tab.url),
            exampleUrl: tab.url
          };
        }
        hostGroups[host].count++;
      } catch {
        // Handle invalid URLs
        const fallbackHost = 'chrome-internal';
        if (!hostGroups[fallbackHost]) {
          hostGroups[fallbackHost] = {
            host: fallbackHost,
            count: 0,
            faviconUrl: null,
            exampleUrl: tab.url
          };
        }
        hostGroups[fallbackHost].count++;
      }
    });
    
    
    // Create hosts container
    const hostsContainer = document.createElement('div');
    hostsContainer.className = 'window-popup-tabs';
    
    // Sort hosts by count (descending) then by name
    const sortedHosts = Object.values(hostGroups).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.host.localeCompare(b.host);
    });
    
    // Add each host group (limit to 5 entries)
    const maxEntries = 5;
    const visibleHosts = sortedHosts.slice(0, maxEntries);
    const remainingCount = sortedHosts.length - maxEntries;
    
    visibleHosts.forEach(hostGroup => {
      const hostElement = document.createElement('div');
      hostElement.className = 'window-popup-tab';
      
      // Create favicon
      const favicon = document.createElement('div');
      favicon.className = 'window-popup-tab-favicon';
      
      if (hostGroup.faviconUrl) {
        const faviconImg = document.createElement('img');
        faviconImg.src = hostGroup.faviconUrl;
        faviconImg.alt = '';
        faviconImg.onerror = () => {
          try {
            const hostname = hostGroup.host.replace('www.', '');
            favicon.textContent = hostname.charAt(0).toUpperCase();
            faviconImg.remove();
          } catch {
            favicon.textContent = '?';
            faviconImg.remove();
          }
        };
        favicon.appendChild(faviconImg);
      } else {
        favicon.textContent = hostGroup.host === 'chrome-internal' ? '🔧' : '?';
      }
      
      // Create host info
      const hostInfo = document.createElement('div');
      hostInfo.className = 'window-popup-tab-info';
      
      const hostUrl = document.createElement('div');
      hostUrl.className = 'window-popup-tab-url';
      hostUrl.textContent = hostGroup.host === 'chrome-internal' ? '(chrome-internal)' : hostGroup.host;
      
      const hostMeta = document.createElement('div');
      hostMeta.className = 'window-popup-tab-meta';
      hostMeta.textContent = `${hostGroup.count} tab${hostGroup.count !== 1 ? 's' : ''}`;
      
      hostInfo.appendChild(hostUrl);
      hostInfo.appendChild(hostMeta);
      
      hostElement.appendChild(favicon);
      hostElement.appendChild(hostInfo);
      hostsContainer.appendChild(hostElement);
    });
    
    // Add "And X more" text if there are additional entries
    if (remainingCount > 0) {
      const moreElement = document.createElement('div');
      moreElement.className = 'window-popup-tab';
      moreElement.style.fontStyle = 'italic';
      moreElement.style.color = '#64748b';
      moreElement.style.justifyContent = 'center';
      moreElement.textContent = `And ${remainingCount} more`;
      hostsContainer.appendChild(moreElement);
    }
    
    popup.appendChild(hostsContainer);
    
    // Position popup
    positionPopup(popup, windowSquare);
    
    // Keep popup visible when hovering over it
    popup.addEventListener('mouseenter', () => {
      popup.classList.add('visible');
    });
    
    popup.addEventListener('mouseleave', () => {
      hideWindowPopup();
    });
    
    // Show popup with animation
    setTimeout(() => {
      popup.classList.add('visible');
    }, 10);
  });
}

// Position popup relative to the window square
function positionPopup(popup, windowSquare) {
  const rect = windowSquare.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  const containerRect = document.querySelector('.container').getBoundingClientRect();
  
  // Calculate position
  let left = rect.left + (rect.width / 2) - (popupRect.width / 2);
  let top = rect.bottom + 8;
  
  // Adjust if popup would go off screen
  if (left < containerRect.left + 10) {
    left = containerRect.left + 10;
  }
  if (left + popupRect.width > containerRect.right - 10) {
    left = containerRect.right - popupRect.width - 10;
  }
  if (top + popupRect.height > containerRect.bottom - 10) {
    top = rect.top - popupRect.height - 8;
  }
  
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

// Hide window popup
function hideWindowPopup() {
  const popup = document.querySelector('.window-popup');
  if (popup) {
    popup.classList.remove('visible');
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 200);
  }
}

// Render window overview
async function renderWindowOverview(windows, searchTerm = '') {
  const windowGrid = document.getElementById('windowGrid');
  const windowCountBadge = document.getElementById('windowCountBadge');
  windowGrid.innerHTML = '';
  
  // Update window count badge
  windowCountBadge.textContent = windows.length;
  
  if (windows.length === 0) {
    windowGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 20px;">No windows found</div>';
    return;
  }
  
  // Normalize search term
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();
  
  // If there's a search term, determine which windows have matching tabs
  const windowHasMatch = new Map();
  if (normalizedSearchTerm) {
    for (const window of windows) {
      const tabs = await getTabsForWindow(window.windowId);
      const hasMatch = tabs.some(tab => 
        (tab.title && tab.title.toLowerCase().includes(normalizedSearchTerm)) ||
        (tab.url && tab.url.toLowerCase().includes(normalizedSearchTerm))
      );
      windowHasMatch.set(window.windowId, hasMatch);
    }
  }
  
  for (const window of windows) {
    const windowSquare = document.createElement('div');
    windowSquare.className = `window-square ${window.isCurrent ? 'current' : ''}`;
    windowSquare.draggable = true;
    windowSquare.dataset.windowId = window.windowId;
    
    // Gray out window if it doesn't have matching tabs
    if (normalizedSearchTerm && !windowHasMatch.get(window.windowId)) {
      windowSquare.classList.add('grayed-out');
    }
    
    // Create tab count badge
    const tabCountBadge = document.createElement('div');
    tabCountBadge.className = 'window-tab-count';
    tabCountBadge.textContent = window.tabCount;
    windowSquare.appendChild(tabCountBadge);
    
    // Generate favicon grid asynchronously
    generateFaviconGrid(window.windowId).then(faviconGrid => {
      if (faviconGrid) {
        windowSquare.appendChild(faviconGrid);
      }
    });
    
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
    
    // Hover event listeners for popup
    let hoverTimeout;
    
    windowSquare.addEventListener('mouseenter', () => {
      showWindowPopup(windowSquare, window.windowId, window.tabCount);
    });
    
    windowSquare.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      hideWindowPopup();
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
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value : '';
    
    // Sync the visible match mode selector with the hidden one
    const matchModeSelect = document.getElementById('matchModeSelect');
    if (matchModeSelect) {
      matchModeSelect.value = mode;
    }
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
    await renderWindowOverview(windows, searchTerm);
    
    render(groups, viewMode, searchTerm);
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
  
  document.getElementById('matchModeSelect').addEventListener('change', async () => {
    const preferences = await loadPreferences();
    const newMatchMode = document.getElementById('matchModeSelect').value;
    preferences.matchMode = newMatchMode;
    // Sync the hidden selector
    document.getElementById('mode').value = newMatchMode;
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
    const allTabs = await chrome.tabs.query({});
    const mode = document.getElementById('mode').value;
    
    // Filter out special pages
    const validTabs = allTabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('edge://')
    );
    
    // Group tabs by canonical key (same logic as duplicate detection)
    const groups = {};
    for (const tab of validTabs) {
      const key = canonicalKey(tab.url, mode);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(tab);
    }
    
    // Find duplicate groups and close all but the first tab in each group
    const tabsToClose = [];
    for (const [key, tabs] of Object.entries(groups)) {
      if (tabs.length > 1) {
        // Keep the first tab, close the rest
        tabsToClose.push(...tabs.slice(1));
      }
    }
    
    if (tabsToClose.length === 0) {
      alert('No duplicate tabs found!');
      return;
    }
    
    const tabIds = tabsToClose.map(tab => tab.id);
    await chrome.tabs.remove(tabIds);
    
    // Track successful action for review prompting
    await trackSuccessfulAction();
    
    refresh();
  } catch (error) {
    console.error('Error consolidating tabs:', error);
    alert('Error consolidating tabs. Please try again.');
  }
  });

  // Add consolidate single windows functionality
  document.getElementById('consolidateSingleWindowsBtn').addEventListener('click', async () => {
  try {
    const [currTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!currTab) return;
    
    const targetWin = currTab.windowId;
    const allTabs = await chrome.tabs.query({});
    
    // Group tabs by window
    const windowTabs = {};
    for (const tab of allTabs) {
      if (!windowTabs[tab.windowId]) {
        windowTabs[tab.windowId] = [];
      }
      windowTabs[tab.windowId].push(tab);
    }
    
    // Find single-tab windows (excluding current window and special pages)
    const singleTabWindows = [];
    for (const [windowId, tabs] of Object.entries(windowTabs)) {
      if (parseInt(windowId) === targetWin) continue; // Skip current window
      
      const validTabs = tabs.filter(tab => 
        tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('edge://')
      );
      
      if (validTabs.length === 1) {
        singleTabWindows.push(validTabs[0]);
      }
    }
    
    if (singleTabWindows.length === 0) {
      alert('No single-tab windows found to consolidate!');
      return;
    }
    
    const tabIds = singleTabWindows.map(tab => tab.id);
    await chrome.tabs.move(tabIds, { windowId: targetWin, index: -1 });
    await chrome.windows.update(targetWin, { focused: true });
    
    // Track successful action for review prompting
    await trackSuccessfulAction();
    
    refresh();
  } catch (error) {
    console.error('Error consolidating single-tab windows:', error);
    alert('Error consolidating single-tab windows. Please try again.');
  }
  });

  // Add consolidate single tabs functionality
  document.getElementById('consolidateSingleTabsBtn').addEventListener('click', async () => {
  try {
    const [currTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!currTab) return;
    
    const targetWin = currTab.windowId;
    const allTabs = await chrome.tabs.query({});
    const mode = document.getElementById('mode').value;
    
    // Filter out special pages
    const validTabs = allTabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('edge://')
    );
    
    // Group tabs by canonical key (same logic as duplicate detection)
    const groups = {};
    for (const tab of validTabs) {
      const key = canonicalKey(tab.url, mode);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(tab);
    }
    
    // Find tabs that are the only instance of their canonical key (excluding tabs in current window)
    const singleTabs = [];
    for (const [key, tabs] of Object.entries(groups)) {
      if (tabs.length === 1 && tabs[0].windowId !== targetWin) {
        singleTabs.push(tabs[0]);
      }
    }
    
    if (singleTabs.length === 0) {
      alert('No unique tabs found to consolidate!');
      return;
    }
    
    const tabIds = singleTabs.map(tab => tab.id);
    await chrome.tabs.move(tabIds, { windowId: targetWin, index: -1 });
    await chrome.windows.update(targetWin, { focused: true });
    
    // Track successful action for review prompting
    await trackSuccessfulAction();
    
    refresh();
  } catch (error) {
    console.error('Error consolidating single tabs:', error);
    alert('Error consolidating single tabs. Please try again.');
  }
  });

  // Initialize search functionality
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  
  if (searchInput && clearSearchBtn) {
    // Handle search input changes
    searchInput.addEventListener('input', () => {
      const searchTerm = searchInput.value.trim();
      
      // Show/hide clear button
      if (searchTerm) {
        clearSearchBtn.style.display = 'flex';
      } else {
        clearSearchBtn.style.display = 'none';
      }
      
      // Refresh with search filter
      refresh();
    });
    
    // Handle clear button click
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      refresh();
    });
    
    // Handle Enter key in search
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        refresh();
      }
    });
  }

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

  // Initialize custom tooltips for consolidate buttons
  initializeCustomTooltips();
  
  // Initialize review functionality
  initializeReviewSystem();
});

// Custom tooltip functionality
let tooltipTimeout;
let currentTooltip = null;

function showCustomTooltip(element, text) {
  // Remove any existing tooltip
  hideCustomTooltip();
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip';
  tooltip.textContent = text;
  tooltip.id = 'customTooltip';
  
  // Add to body
  document.body.appendChild(tooltip);
  currentTooltip = tooltip;
  
  // Position tooltip
  const rect = element.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // Center horizontally below the button
  const left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
  const top = rect.bottom + 12; // 12px gap below button
  
  // Ensure tooltip stays within viewport
  const adjustedLeft = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
  const adjustedTop = Math.min(top, window.innerHeight - tooltipRect.height - 10);
  
  tooltip.style.left = `${adjustedLeft}px`;
  tooltip.style.top = `${adjustedTop}px`;
  
  // Show tooltip with animation
  setTimeout(() => {
    if (tooltip.parentNode) {
      tooltip.classList.add('visible');
    }
  }, 10);
}

function hideCustomTooltip() {
  if (currentTooltip) {
    currentTooltip.classList.remove('visible');
    setTimeout(() => {
      if (currentTooltip && currentTooltip.parentNode) {
        currentTooltip.remove();
      }
      currentTooltip = null;
    }, 200);
  }
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
}

function initializeCustomTooltips() {
  // Get all buttons with data-tooltip attribute
  const tooltipButtons = document.querySelectorAll('[data-tooltip]');
  
  tooltipButtons.forEach(button => {
    const tooltipText = button.getAttribute('data-tooltip');
    
    button.addEventListener('mouseenter', () => {
      tooltipTimeout = setTimeout(() => {
        showCustomTooltip(button, tooltipText);
      }, 500); // 500ms delay before showing
    });
    
    button.addEventListener('mouseleave', () => {
      hideCustomTooltip();
    });
    
    button.addEventListener('focus', () => {
      tooltipTimeout = setTimeout(() => {
        showCustomTooltip(button, tooltipText);
      }, 500);
    });
    
    button.addEventListener('blur', () => {
      hideCustomTooltip();
    });
  });
}

// Initialize review system
async function initializeReviewSystem() {
  // Check if review is disabled and hide the review button if so
  const reviewData = await loadReviewData();
  const reviewBtn = document.getElementById('reviewBtn');
  if (reviewBtn) {
    if (reviewData.reviewDisabled) {
      reviewBtn.style.display = 'none';
    } else {
      reviewBtn.addEventListener('click', showReviewPopup);
    }
  }
  
  // Review popup close button
  const reviewPopupClose = document.getElementById('reviewPopupClose');
  if (reviewPopupClose) {
    reviewPopupClose.addEventListener('click', async () => {
      const reviewData = await loadReviewData();
      reviewData.reviewDismissed = true;
      await saveReviewData(reviewData);
      hideReviewPopup();
    });
  }

  // Star buttons
  const starButtons = document.querySelectorAll('.star-btn');
  starButtons.forEach((starBtn, index) => {
    starBtn.addEventListener('click', () => {
      // Mark all stars up to clicked star as active
      starButtons.forEach((btn, i) => {
        if (i <= index) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      
      // Open review page after a short delay
      setTimeout(() => {
        openReviewPage();
      }, 500);
    });

    // Add hover effect: highlight all stars to the left when hovering
    starBtn.addEventListener('mouseenter', () => {
      starButtons.forEach((btn, i) => {
        if (i <= index) {
          btn.classList.add('hover-highlight');
        } else {
          btn.classList.remove('hover-highlight');
        }
      });
    });

    starBtn.addEventListener('mouseleave', () => {
      // Remove hover highlight from all stars
      starButtons.forEach(btn => {
        btn.classList.remove('hover-highlight');
      });
    });
  });

  // Never show again link
  const neverShowAgainLink = document.getElementById('neverShowAgainLink');
  if (neverShowAgainLink) {
    neverShowAgainLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const reviewData = await loadReviewData();
      reviewData.reviewDisabled = true;
      await saveReviewData(reviewData);
      
      // Hide the review button in the header
      const reviewBtn = document.getElementById('reviewBtn');
      if (reviewBtn) {
        reviewBtn.style.display = 'none';
      }
      
      hideReviewPopup();
    });
  }

  // Close popup when clicking outside
  const reviewPopup = document.getElementById('reviewPopup');
  if (reviewPopup) {
    reviewPopup.addEventListener('click', (e) => {
      if (e.target === reviewPopup) {
        hideReviewPopup();
      }
    });
  }
}