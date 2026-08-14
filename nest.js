// Storage key reference for the extension's local storage
const STORAGE_KEY = 'nest_data';
const PALETTE = ['#c4a55a', '#5b8fa8', '#8b74c4', '#9a6f5a', '#6fa87f', '#c46f8b']; // diff project colors

// Global UI state shared across rendering and event handlers.
let state = {
  projects: [],
  activeProjectId: null,
  ui: {
    tab: 'pages',
    dropdownOpen: false,
    queryStatus: 'idle', // idle | loading | results
    queryText: '',
    lastQuery: '',
    queryResults: [],
  },
};

// ─── Storage ────────────────────────────────────────────────────────────

// Keep the current project list and the active project selection -> restores the user's saved research collection on the next open.
async function loadState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const data = stored[STORAGE_KEY]; // get all the data under the STORAGE_KEY

  if (data && data.projects && data.projects.length) {
    // Restore the saved state if it exists
    state.projects = data.projects;
    state.activeProjectId = data.activeProjectId ?? data.projects[0].id;
  } else {
    // If no saved state exists, create a default project
    state.projects = [{ id: cryptoId(), name: 'My Research', color: PALETTE[0], pages: [] }];
    state.activeProjectId = state.projects[0].id;

    await persist(); // save the initial state to local storage
  }
}

// Save the current state to local storage whenever it changes.
async function persist() {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { projects: state.projects, activeProjectId: state.activeProjectId },
  });
}

// Generate a unique ID for each project.
function cryptoId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Helpers ────────────────────────────────────────────────────

// Get the currently active project based on the activeProjectId in state.
function activeProject() {
  return state.projects.find(p => p.id === state.activeProjectId) ?? state.projects[0]; // get first project if activeProjectId is invalid
}

// Extract the domain from a URL, removing the "www." if present
function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Format a date object into a human-readable string (e.g., "Jan 1, 2024")
function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
