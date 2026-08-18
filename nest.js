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

// Draw the dropdown list of available projects and allow switching between them
function renderProjectList(activeProj) {
  const list = el('project-list');
  list.innerHTML = '';

  // Render each project in the list
  state.projects.forEach(p => {
    const row = document.createElement('div');

    // Check if the project is the active one and apply the 'active' class
    row.className = 'project-row' + (p.id === activeProj.id ? ' active' : '');

    row.innerHTML = `
      <span class="dot" style="background:${p.color}"></span>
      <span class="project-row-name">${escapeHtml(p.name)}</span>
      <span class="mono small muted">${p.pages.length}</span>
      ${p.id === activeProj.id ? checkSvg() : ''}
    `;

    // Add click event to switch to the selected project when clicked
    row.addEventListener('click', () => {
      state.activeProjectId = p.id;
      state.ui.dropdownOpen = false;
      state.ui.tab = 'pages';
      persist();
      render();
    });

    // Add the project row to the list
    list.appendChild(row);
  });
}

// Return an SVG checkmark icon for the active project in the dropdown list
function checkSvg() {
  return `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-5" stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// Render the saved page list
function renderPages(project) {
  const listEl = el('pages-list');
  const emptyEl = el('empty-state');

  // If there are no pages in the project, show the empty state message and hide the list
  if (project.pages.length === 0) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  // If there are pages, show the list and hide the empty state message
  listEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  listEl.innerHTML = '';
  // Show the newest first (reverse order)
  [...project.pages].reverse().forEach(page => {
    // Create a new div element for each page item
    const item = document.createElement('div');
    item.className = 'page-item';

    const letter = (page.domain.replace('www.', '')[0] || '?').toUpperCase(); // Get the first letter of the domain for favicon

    // Page details: favicon, title, domain, snippet, and remove button
    item.innerHTML = `
      <div class="page-item-top">
        <div class="favicon" style="background:${project.color}22;color:${project.color};border:1px solid ${project.color}33">${letter}</div>
        <div class="page-info">
          <p class="page-title" title="${escapeHtml(page.title)}">${escapeHtml(page.title)}</p>
          <p class="page-domain">${escapeHtml(page.domain)}</p>
          <p class="page-snippet">${escapeHtml(page.snippet)}</p>
        </div>
        <button class="page-remove" title="Remove page">✕</button>
      </div>
      <div class="page-added">Added ${escapeHtml(page.addedAt)}</div>
    `;

    // Open the page in a new tab when the title is clicked
    item.querySelector('.page-title').addEventListener('click', () => chrome.tabs.create({ url: page.url }));
    // Change the cursor to pointer when hovering over the title 
    item.querySelector('.page-title').style.cursor = 'pointer';
    // Add click event to the remove button to delete the page from the project
    item.querySelector('.page-remove').addEventListener('click', e => {
      e.stopPropagation();
      project.pages = project.pages.filter(p => p.id !== page.id);
      persist();
      render();
    });

    // Append the page item to the list element
    listEl.appendChild(item);
  });
}

// Render the query tab by toggling idle/loading/results states
function renderQuery(project) {
  // Diff states: idle (no query), loading (query in progress), results (query completed)
  const idle = el('query-idle');
  const loading = el('query-loading');
  const results = el('query-results');

  idle.classList.add('hidden');
  loading.classList.add('hidden');
  results.classList.add('hidden');

  el('query-idle-desc').innerHTML =
    `Query across all ${project.pages.length} pages in <span style="color:${project.color}">${escapeHtml(project.name)}</span>.`;

  // Show the appropriate state based on the current query status
  if (state.ui.queryStatus === 'loading') {
    loading.classList.remove('hidden');
    el('query-loading-text').textContent = `Searching across ${project.pages.length} pages…`;
  } else if (state.ui.queryStatus === 'results') {
    results.classList.remove('hidden');
    el('query-results-label').textContent = `Results for "${state.ui.lastQuery}"`;
    renderResultsList(project);
  } else {
    idle.classList.remove('hidden');
  }

  // Input box for query
  const input = el('query-input');

  // If the input is not focused, update its value
  if (document.activeElement !== input) input.value = state.ui.queryText;

  // Toggle the 'has-text' class on the input row based on whether the query text is empty
  const row = el('query-input-row');
  row.classList.toggle('has-text', state.ui.queryText.trim().length > 0);

  // Toggle the 'active' class on the submit button based on whether there is query text
  el('query-submit').classList.toggle('active', state.ui.queryText.trim().length > 0);
}
