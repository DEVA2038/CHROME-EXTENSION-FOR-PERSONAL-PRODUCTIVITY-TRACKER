let activeTab = null;
let startTime = null;
let currentUrl = null;

// Track user idle state
let isIdle = false;

chrome.idle.onStateChanged.addListener((newState) => {
  isIdle = newState === 'idle' || newState === 'locked';
  
  if (isIdle) {
    // Pause tracking when idle
    if (activeTab && startTime) {
      const timeSpent = Date.now() - startTime;
      recordTimeSpent(activeTab, timeSpent);
      startTime = null;
    }
  } else {
    // Resume tracking when active
    if (activeTab) {
      startTime = Date.now();
    }
  }
});

// Productivity data structure
let productivityData = {
  dailyGoals: {},
  timeSpent: {},
  productiveSites: [],
  distractingSites: []
};

// Load saved data
chrome.storage.local.get('productivityData', (result) => {
  if (result.productivityData) {
    productivityData = result.productivityData;
  }
});

// Track tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (!tab.url) return;
    
    // Record time spent on previous tab
    if (activeTab && startTime) {
      const timeSpent = Date.now() - startTime;
      recordTimeSpent(activeTab, timeSpent);
    }
    
    // Start tracking new tab
    activeTab = {
      id: activeInfo.tabId,
      url: new URL(tab.url).hostname
    };
    currentUrl = activeTab.url;
    startTime = Date.now();
  });
});

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message
  });
}

// Check for excessive time on distracting sites
setInterval(() => {
  if (activeTab && productivityData.distractingSites.includes(activeTab.url)) {
    const timeSpent = (Date.now() - startTime) / (1000 * 60); // minutes
    if (timeSpent > 30) { // 30 minute threshold
      showNotification('Distraction Alert', 
        `You've spent ${Math.round(timeSpent)} minutes on ${activeTab.url}`);
    }
  }
}, 60000); // Check every minute

// Use sync instead of local storage
function saveData() {
  chrome.storage.sync.set({ productivityData }, () => {
    console.log('Data synced');
  });
}

// Load with sync storage
chrome.storage.sync.get('productivityData', (result) => {
  if (result.productivityData) {
    productivityData = result.productivityData;
  }
});

// Track tab updates (e.g., navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    // Record time spent on previous URL
    if (activeTab && startTime) {
      const timeSpent = Date.now() - startTime;
      recordTimeSpent(activeTab, timeSpent);
    }
    
    // Update to new URL
    activeTab = {
      id: tabId,
      url: new URL(changeInfo.url).hostname
    };
    currentUrl = activeTab.url;
    startTime = Date.now();
  }
});

// Record time spent on a website
function recordTimeSpent(tab, timeSpent) {
  const today = new Date().toISOString().split('T')[0];
  
  if (!productivityData.timeSpent[today]) {
    productivityData.timeSpent[today] = {};
  }
  
  if (!productivityData.timeSpent[today][tab.url]) {
    productivityData.timeSpent[today][tab.url] = 0;
  }
  
  productivityData.timeSpent[today][tab.url] += timeSpent;
  
  // Save updated data
  chrome.storage.local.set({ productivityData });
}

// Periodically save data when tab is active
setInterval(() => {
  if (activeTab && startTime) {
    const timeSpent = Date.now() - startTime;
    recordTimeSpent(activeTab, timeSpent);
    startTime = Date.now();
  }
}, 60000); // Update every minute
