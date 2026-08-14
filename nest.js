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

// ─── Rendering ──────────────────────────────────────────────────────────

const el = id => document.getElementById(id); // Get an element by its ID

// Render the entire UI based on the current state, including project info, tabs, pages, and query results.
function render() {
  const project = activeProject(); // Get the currently active project
  if (!project) return;

  // Project pill
  el('project-dot').style.background = project.color; // Set the color of the project dot to the project's color
  el('project-name').textContent = project.name; // Set the project name in the UI
  el('project-count').textContent = `${project.pages.length} page${project.pages.length !== 1 ? 's' : ''}`; // Show the number of pages in the project
  el('project-chevron').style.transform = state.ui.dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'; // Rotate the icon if dropdown is open

  // Dropdown
  el('project-dropdown').classList.toggle('hidden', !state.ui.dropdownOpen); // Show or hide the project dropdown based on the state
  renderProjectList(project); // Render the list of available projects in the dropdown

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === state.ui.tab); // Highlight the active tab based on the current state
  });
  el('pages-view').classList.toggle('hidden', state.ui.tab !== 'pages'); // Show or hide the pages view based on the current tab
  el('query-view').classList.toggle('hidden', state.ui.tab !== 'query'); // Show or hide the query view based on the current tab

  // Pages view
  renderPages(project);

  // Query view
  renderQuery(project);

  // Status bar
  if (state.ui.addError) {
    el('status-text').textContent = state.ui.addError; // Display any error message related to adding a page
    el('status-text').style.color = 'var(--color-danger)';
  } else if (state.ui.tab === 'query' && state.ui.queryStatus === 'loading') {
    el('status-text').textContent = `Searching across ${project.pages.length} pages…`; // Display a loading message while searching
    el('status-text').style.color = '';
  } else {
    el('status-text').textContent = `${project.pages.length} article${project.pages.length !== 1 ? 's' : ''} indexed`; // Display the number of articles
    el('status-text').style.color = '';
  }

  // Add page button state
  el('add-page-btn').disabled = state.ui.addingPage === true;
  el('add-page-label').textContent = state.ui.addingPage ? 'Adding…' : 'Add current page'; // Update the button label based on whether a page is being added
}
