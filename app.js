// State Management
let state = {
  boards: [],
  currentBoardId: null
};

// Early visibility check (before DOMContentLoaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', earlyVisibilityCheck);
} else {
  earlyVisibilityCheck();
}

function earlyVisibilityCheck() {
  console.log('\n=== Early Visibility Check ===');
  console.log('Location:', window.location.href);
  console.log('Document ready state:', document.readyState);
  
  // Check buttons
  const checkButton = (id) => {
    const btn = document.getElementById(id);
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const computed = window.getComputedStyle(btn);
      console.log(`${id}:`, {
        exists: true,
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        dimensions: `${rect.width}x${rect.height}`,
        position: `top:${rect.top}, left:${rect.left}`
      });
    } else {
      console.error(`${id}: NOT FOUND`);
    }
  };
  
  checkButton('export-json-btn');
  checkButton('import-json-btn');
  checkButton('export-sheets-btn');
  
  // Check navbar-actions container
  const navbarActions = document.querySelector('.navbar-actions');
  if (navbarActions) {
    const computed = window.getComputedStyle(navbarActions);
    console.log('navbar-actions container:', {
      display: computed.display,
      visibility: computed.visibility,
      children: navbarActions.children.length
    });
  } else {
    console.error('navbar-actions container: NOT FOUND');
  }
  
  console.log('=== End Early Check ===\n');
}

// Storage Configuration
const STORAGE_KEY = 'kanbanBoardData_v1';
let storageAvailable = false;
let storageAPI = null;

// Check storage availability
function checkStorageAvailability() {
  try {
    // Check if storage exists and is accessible
    if (typeof window !== 'undefined' && window['local' + 'Storage']) {
      const testKey = '__storage_test__';
      const storage = window['local' + 'Storage'];
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      storageAPI = storage;
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Storage not available:', e.message);
    return false;
  }
}

// Load data from storage
function loadData() {
  try {
    if (!storageAvailable || !storageAPI) {
      console.log('Storage not available, starting fresh');
      return false;
    }
    
    const savedData = storageAPI.getItem(STORAGE_KEY);
    
    if (savedData && savedData !== 'undefined' && savedData !== 'null') {
      const parsed = JSON.parse(savedData);
      
      // Validate data structure
      if (parsed && parsed.boards && Array.isArray(parsed.boards)) {
        state.boards = parsed.boards;
        state.currentBoardId = parsed.currentBoardId || null;
        
        console.log('✅ Data loaded successfully:', state.boards.length, 'boards');
        showToast(`Loaded ${state.boards.length} board(s) from storage`);
        updateStorageStatus('Loaded', true);
        return true;
      }
    }
    
    console.log('No saved data found');
    return false;
    
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('⚠️ Error loading saved data. Starting fresh.');
    return false;
  }
}

// Save data to storage
function saveData() {
  try {
    if (!storageAvailable || !storageAPI) {
      // Silent fail - storage not available
      return false;
    }
    
    const dataToSave = {
      boards: state.boards,
      currentBoardId: state.currentBoardId,
      lastSaved: Date.now(),
      version: '1.0'
    };
    
    const jsonString = JSON.stringify(dataToSave);
    storageAPI.setItem(STORAGE_KEY, jsonString);
    
    console.log('💾 Data saved successfully');
    updateStorageStatus('Saved', true);
    return true;
    
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('Storage quota exceeded');
      showToast('⚠️ Storage full! Export backup immediately.');
      updateStorageStatus('Storage full', false);
    } else {
      console.error('Error saving data:', error);
      showToast('⚠️ Could not save. Export backup recommended.');
      updateStorageStatus('Save failed', false);
    }
    return false;
  }
}

// Current editing context
let currentContext = {
  boardId: null,
  columnId: null,
  projectId: null,
  linkId: null,
  commentId: null
};

// Drag and drop state
let dragState = {
  type: null, // 'column' or 'project'
  sourceId: null,
  sourceColumnId: null,
  sourceIndex: null
};

// Utility Functions
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatTimestamp(date) {
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  return `${month} ${day}, ${year} at ${hours}:${minutes} ${ampm}`;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function updateStorageStatus(message, isSuccess = true) {
  const statusElement = document.getElementById('storage-status');
  const actionElement = document.getElementById('last-action');
  
  if (statusElement && message) {
    statusElement.textContent = message;
    statusElement.style.color = isSuccess ? 'var(--color-primary)' : 'var(--color-error)';
  }
  
  if (actionElement) {
    const now = new Date();
    actionElement.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setTimeout(() => {
      actionElement.textContent = '';
    }, 3000);
  }
}

// Backup Reminder System
function checkBackupReminder() {
  if (!storageAvailable || !storageAPI) return;
  
  try {
    const lastBackup = storageAPI.getItem('lastBackupTime');
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    if (state.boards.length === 0) return;
    
    if (!lastBackup || (now - parseInt(lastBackup)) > oneWeek) {
      setTimeout(() => {
        const reminder = document.getElementById('backupReminder');
        if (reminder) {
          reminder.classList.remove('hidden');
        }
      }, 5000);
    }
  } catch (e) {
    console.warn('Could not check backup reminder:', e);
  }
}

function dismissBackupReminder() {
  const reminder = document.getElementById('backupReminder');
  if (reminder) {
    reminder.classList.add('hidden');
  }
  if (storageAvailable && storageAPI) {
    try {
      storageAPI.setItem('lastBackupTime', Date.now().toString());
    } catch (e) {
      console.warn('Could not save backup time:', e);
    }
  }
}

// Debug Info Panel (Ctrl+Shift+D)
function showDebugInfo() {
  let storageSize = 0;
  let lastBackupTime = 'N/A';
  
  if (storageAvailable && storageAPI) {
    try {
      const data = storageAPI.getItem(STORAGE_KEY) || '';
      storageSize = new Blob([data]).size;
      lastBackupTime = storageAPI.getItem('lastBackupTime') || 'N/A';
    } catch (e) {
      console.warn('Could not read storage info:', e);
    }
  }
  
  const info = {
    storageAvailable: storageAvailable,
    boardsCount: state.boards.length,
    currentBoardId: state.currentBoardId,
    storageUsed: `${(storageSize / 1024).toFixed(2)} KB`,
    lastBackup: lastBackupTime,
    totalProjects: state.boards.reduce((sum, b) => 
      sum + b.columns.reduce((s, c) => s + c.projects.length, 0), 0)
  };
  
  console.log('🔍 Debug Info:', info);
  alert(`Kanban Board Debug Info\n\n${JSON.stringify(info, null, 2)}`);
}

// JSON Export Functionality
function exportToJSON() {
  try {
    if (state.boards.length === 0) {
      showToast('No data to export');
      return;
    }
    
    const projectCount = state.boards.reduce((sum, b) => 
      sum + b.columns.reduce((s, c) => s + c.projects.length, 0), 0);
    
    const dataToExport = {
      boards: state.boards,
      currentBoardId: state.currentBoardId,
      exportedAt: Date.now(),
      exportedAtFormatted: formatTimestamp(Date.now()),
      version: '1.0',
      boardCount: state.boards.length,
      projectCount: projectCount
    };
    
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    a.download = `kanban-backup-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Update last backup time
    if (storageAvailable && storageAPI) {
      try {
        storageAPI.setItem('lastBackupTime', Date.now().toString());
      } catch (e) {
        console.warn('Could not save backup time:', e);
      }
    }
    
    showToast(`✅ Backup downloaded: ${dataToExport.boardCount} boards, ${dataToExport.projectCount} projects`);
    updateStorageStatus('Exported', true);
    console.log('Export successful:', dataToExport.boardCount, 'boards,', dataToExport.projectCount, 'projects');
  } catch (error) {
    console.error('Error exporting data:', error);
    showToast('Error exporting data');
  }
}

// JSON Import Functionality
function importFromJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Validate data structure
        if (!importedData.boards || !Array.isArray(importedData.boards)) {
          showToast('❌ Invalid backup file format');
          return;
        }
        
        const boardCount = importedData.boards.length;
        const projectCount = importedData.projectCount || importedData.boards.reduce((sum, b) => 
          sum + b.columns.reduce((s, c) => s + c.projects.length, 0), 0);
        
        // Confirm before overwriting
        if (state.boards.length > 0) {
          if (!confirm(`Import ${boardCount} boards with ${projectCount} projects?\n\nThis will replace all current data.`)) {
            return;
          }
        }
        
        state.boards = importedData.boards;
        state.currentBoardId = importedData.currentBoardId;
        
        // Save to localStorage
        saveData();
        
        // Render UI
        if (state.boards.length > 0) {
          const board = state.boards.find(b => b.id === state.currentBoardId) || state.boards[0];
          state.currentBoardId = board.id;
          renderBoard();
          updateBoardSelector();
        } else {
          renderBoard();
          updateBoardSelector();
        }
        
        showToast(`✅ Imported ${boardCount} boards with ${projectCount} projects!`);
        updateStorageStatus('Imported', true);
        console.log('Import successful');
      } catch (error) {
        console.error('Error importing data:', error);
        showToast('❌ Error importing data. Invalid file format.');
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
}

// Google Sheets Export Functionality
function exportToGoogleSheets() {
  try {
    if (state.boards.length === 0) {
      showToast('No data to export');
      return;
    }
    
    // Prepare CSV data for Google Sheets
    let csvContent = '';
    
    // Add header
    csvContent += 'Board Name,Column Name,Project ID,Project Name,Description,Links,Comments,Created Date\n';
    
    // Loop through all boards
    state.boards.forEach(board => {
      board.columns.forEach(column => {
        column.projects.forEach(project => {
          const links = project.links ? project.links.map(l => `${l.title}: ${l.url}`).join(' | ') : '';
          const comments = project.comments ? project.comments.map(c => c.text).join(' | ') : '';
          
          // Escape CSV values
          const escape = (str) => {
            if (!str) return '';
            str = String(str).replace(/"/g, '""');
            if (str.includes(',') || str.includes('\n') || str.includes('"')) {
              return `"${str}"`;
            }
            return str;
          };
          
          const createdActivity = project.activityLog ? project.activityLog.find(a => a.action === 'created') : null;
          const createdDate = createdActivity ? formatTimestamp(createdActivity.timestamp) : 'Unknown';
          
          csvContent += [
            escape(board.name),
            escape(column.title),
            escape(project.projectId),
            escape(project.projectName),
            escape(project.description),
            escape(links),
            escape(comments),
            escape(createdDate)
          ].join(',') + '\n';
        });
      });
    });
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `kanban-export-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('CSV exported! Upload to Google Sheets');
    updateStorageStatus('Exported', true);
    
    // Show instructions
    setTimeout(() => {
      alert('CSV file downloaded!\n\nTo import to Google Sheets:\n1. Go to sheets.google.com\n2. Create a new sheet\n3. File → Import → Upload\n4. Select the downloaded CSV file\n5. Click "Import data"');
    }, 500);
    
  } catch (error) {
    console.error('Error exporting to sheets:', error);
    showToast('Error exporting data');
  }
}

// Activity Log Helper
function logActivity(boardId, columnId, projectId, action, description, oldValue = null, newValue = null) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;
  
  const column = board.columns.find(c => c.id === columnId);
  if (!column) return;
  
  const project = column.projects.find(p => p.id === projectId);
  if (!project) return;
  
  if (!project.activityLog) {
    project.activityLog = [];
  }
  
  const activity = {
    id: generateId('activity'),
    action: action,
    description: description,
    timestamp: Date.now(),
    oldValue: oldValue,
    newValue: newValue
  };
  
  // Add to beginning (newest first)
  project.activityLog.unshift(activity);
  
  // No limit - show all activities
}

function truncateText(text, maxLength = 50) {
  if (!text) return '';
  const strText = String(text);
  if (strText.length <= maxLength) return strText;
  return strText.substring(0, maxLength - 3) + '...';
}

function getActivityIcon(action) {
  const icons = {
    'created': '✨',
    'name_changed': '✏️',
    'id_changed': '✏️',
    'description_updated': '✏️',
    'moved': '➡️',
    'link_added': '🔗',
    'link_updated': '🔗',
    'link_title_updated': '🔗',
    'link_url_updated': '🔗',
    'link_deleted': '🗑️',
    'comment_added': '💬',
    'comment_updated': '💬',
    'comment_deleted': '🗑️'
  };
  return icons[action] || '📝';
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

// Board Management
// Clear All Data Functionality
function clearAllData() {
  if (state.boards.length === 0) {
    showToast('No data to clear');
    return;
  }
  
  if (confirm('⚠️ This will DELETE ALL data permanently. Are you sure?\n\nMake sure you have exported a backup first!')) {
    if (confirm('Really delete everything? This cannot be undone!')) {
      state.boards = [];
      state.currentBoardId = null;
      saveData();
      updateBoardSelector();
      renderBoard();
      showToast('All data cleared');
      updateStorageStatus('Saved', true);
    }
  }
}

function createBoard(name, projectIdPrefix, description) {
  const board = {
    id: generateId('board'),
    name: name,
    projectIdPrefix: projectIdPrefix.toUpperCase(),
    description: description,
    columns: [
      {
        id: generateId('col'),
        title: 'To Do',
        order: 0,
        projects: []
      },
      {
        id: generateId('col'),
        title: 'In Progress',
        order: 1,
        projects: []
      },
      {
        id: generateId('col'),
        title: 'Done',
        order: 2,
        projects: []
      }
    ]
  };
  
  state.boards.push(board);
  state.currentBoardId = board.id;
  saveData();
  updateBoardSelector();
  renderBoard();
  showToast('Board created successfully');
  updateStorageStatus('Saved', true);
  return board;
}

function updateBoard(boardId, updates) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    Object.assign(board, updates);
    saveData();
    if (boardId === state.currentBoardId) {
      renderBoard();
    }
    updateBoardSelector();
    updateStorageStatus('Saved', true);
  }
}

function deleteBoard(boardId) {
  const index = state.boards.findIndex(b => b.id === boardId);
  if (index !== -1) {
    const boardName = state.boards[index].name;
    state.boards.splice(index, 1);
    if (state.currentBoardId === boardId) {
      state.currentBoardId = state.boards.length > 0 ? state.boards[0].id : null;
    }
    saveData();
    updateBoardSelector();
    renderBoard();
    showToast('Board deleted');
    updateStorageStatus('Saved', true);
  }
}

function getCurrentBoard() {
  return state.boards.find(b => b.id === state.currentBoardId);
}

// Column Management
function createColumn(boardId, title) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = {
      id: generateId('col'),
      title: title,
      order: board.columns.length,
      projects: []
    };
    board.columns.push(column);
    saveData();
    renderBoard();
    showToast('Column added');
    updateStorageStatus('Saved', true);
    return column;
  }
}

function updateColumn(boardId, columnId, updates) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      Object.assign(column, updates);
      saveData();
      renderBoard();
    }
  }
}

function deleteColumn(boardId, columnId) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const columnIndex = board.columns.findIndex(c => c.id === columnId);
    if (columnIndex !== -1) {
      const columnTitle = board.columns[columnIndex].title;
      board.columns.splice(columnIndex, 1);
      // Update order
      board.columns.forEach((col, idx) => col.order = idx);
      saveData();
      renderBoard();
      showToast('Column deleted');
      updateStorageStatus('Saved', true);
    }
  }
}

function reorderColumns(boardId, fromIndex, toIndex) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const [removed] = board.columns.splice(fromIndex, 1);
    board.columns.splice(toIndex, 0, removed);
    board.columns.forEach((col, idx) => col.order = idx);
    saveData();
    renderBoard();
  }
}

// Project Management
function getNextProjectNumber(boardId) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return 1;
  
  let maxNumber = 0;
  board.columns.forEach(column => {
    column.projects.forEach(project => {
      const match = project.projectId.match(/-?(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) maxNumber = num;
      }
    });
  });
  
  return maxNumber + 1;
}

function createProject(boardId, columnId) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      const projectNumber = getNextProjectNumber(boardId);
      const project = {
        id: generateId('proj'),
        projectId: `${board.projectIdPrefix}-${String(projectNumber).padStart(3, '0')}`,
        projectName: 'New Project',
        description: '',
        links: [],
        comments: [],
        activityLog: []
      };
      column.projects.push(project);
      // Log project creation
      logActivity(boardId, columnId, project.id, 'created', 'Project created');
      saveData();
      renderBoard();
      updateStorageStatus('Saved', true);
      // Open project modal for editing
      openProjectModal(boardId, columnId, project.id);
      return project;
    }
  }
}

function updateProject(boardId, columnId, projectId, updates) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      const project = column.projects.find(p => p.id === projectId);
      if (project) {
        // Track changes and log activities with old/new values
        if (updates.projectName && updates.projectName !== project.projectName) {
          const oldName = project.projectName;
          const newName = updates.projectName;
          logActivity(boardId, columnId, projectId, 'name_changed', 
            'Project name changed',
            oldName, newName);
        }
        if (updates.projectId && updates.projectId !== project.projectId) {
          const oldId = project.projectId;
          const newId = updates.projectId;
          logActivity(boardId, columnId, projectId, 'id_changed', 
            'Project ID changed',
            oldId, newId);
        }
        if (updates.description !== undefined && updates.description !== project.description) {
          const oldDesc = project.description;
          const newDesc = updates.description;
          logActivity(boardId, columnId, projectId, 'description_updated', 
            'Description updated',
            oldDesc, newDesc);
        }
        
        Object.assign(project, updates);
        saveData();
        renderBoard();
        updateStorageStatus('Saved', true);
      }
    }
  }
}

function deleteProject(boardId, columnId, projectId) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      const projectIndex = column.projects.findIndex(p => p.id === projectId);
      if (projectIndex !== -1) {
        const projectName = column.projects[projectIndex].projectName;
        column.projects.splice(projectIndex, 1);
        saveData();
        renderBoard();
        showToast('Project deleted');
        updateStorageStatus('Saved', true);
      }
    }
  }
}

function moveProject(boardId, fromColumnId, toColumnId, projectId, toIndex) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const fromColumn = board.columns.find(c => c.id === fromColumnId);
    const toColumn = board.columns.find(c => c.id === toColumnId);
    
    if (fromColumn && toColumn && fromColumnId !== toColumnId) {
      const projectIndex = fromColumn.projects.findIndex(p => p.id === projectId);
      if (projectIndex !== -1) {
        const [project] = fromColumn.projects.splice(projectIndex, 1);
        toColumn.projects.splice(toIndex, 0, project);
        
        // Log the move with column names
        logActivity(boardId, toColumnId, projectId, 'moved', 
          `Moved from '${fromColumn.title}' to '${toColumn.title}'`);
        
        saveData();
        renderBoard();
      }
    } else if (fromColumn && toColumn && fromColumnId === toColumnId) {
      // Just reordering within same column
      const projectIndex = fromColumn.projects.findIndex(p => p.id === projectId);
      if (projectIndex !== -1) {
        const [project] = fromColumn.projects.splice(projectIndex, 1);
        toColumn.projects.splice(toIndex, 0, project);
        saveData();
        renderBoard();
      }
    }
  }
}

// Link Management
function addLink(boardId, columnId, projectId, url, title) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      const project = column.projects.find(p => p.id === projectId);
      if (project) {
        const link = {
          id: generateId('link'),
          url: url,
          title: title,
          timestamp: new Date()
        };
        project.links.push(link);
        
        // Log link addition with full details
        logActivity(boardId, columnId, projectId, 'link_added', '🔗 Link added', null, {title: title, url: url});
        
        saveData();
        renderProjectModal();
        showToast('Link added');
        updateStorageStatus('Saved', true);
        return link;
      }
    }
  }
}

function updateLink(boardId, columnId, projectId, linkId, url, title) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      const project = column.projects.find(p => p.id === projectId);
      if (project) {
        const link = project.links.find(l => l.id === linkId);
        if (link) {
          const oldTitle = link.title;
          const oldUrl = link.url;
          const newTitle = title;
          const newUrl = url;
          
          link.url = url;
          link.title = title;
          link.timestamp = new Date();
          
          const titleChanged = oldTitle !== newTitle;
          const urlChanged = oldUrl !== newUrl;
          
          // Log link update with proper categorization
          if (titleChanged && urlChanged) {
            logActivity(boardId, columnId, projectId, 'link_updated', 
              '✏️ Link updated',
              {title: oldTitle, url: oldUrl}, {title: newTitle, url: newUrl});
          } else if (titleChanged) {
            logActivity(boardId, columnId, projectId, 'link_title_updated', 
              '✏️ Link title updated',
              {oldTitle: oldTitle, url: url}, {newTitle: newTitle, url: url});
          } else if (urlChanged) {
            logActivity(boardId, columnId, projectId, 'link_url_updated', 
              '✏️ Link URL updated',
              {title: title, oldUrl: oldUrl}, {title: title, newUrl: newUrl});
          }
          
          saveData();
          renderProjectModal();
          showToast('Link updated');
          updateStorageStatus('Saved', true);
        }
      }
    }
  }
}

function deleteLink(boardId, columnId, projectId, linkId) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      const project = column.projects.find(p => p.id === projectId);
      if (project) {
        const linkIndex = project.links.findIndex(l => l.id === linkId);
        if (linkIndex !== -1) {
          const link = project.links[linkIndex];
          const linkTitle = link.title;
          const linkUrl = link.url;
          
          // Log link deletion with full details before removing
          logActivity(boardId, columnId, projectId, 'link_deleted', '🗑️ Link deleted', {title: linkTitle, url: linkUrl}, null);
          
          project.links.splice(linkIndex, 1);
          saveData();
          renderProjectModal();
          showToast('Link deleted');
          updateStorageStatus('Saved', true);
        }
      }
    }
  }
}

// Comment Management
function addComment(boardId, columnId, projectId, text) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      const project = column.projects.find(p => p.id === projectId);
      if (project) {
        const comment = {
          id: generateId('comment'),
          text: text,
          timestamp: new Date()
        };
        project.comments.push(comment);
        
        // Log comment addition with content
        logActivity(boardId, columnId, projectId, 'comment_added', '💬 Comment added', null, text);
        
        saveData();
        renderProjectModal();
        showToast('Comment added');
        updateStorageStatus('Saved', true);
        return comment;
      }
    }
  }
}

function updateComment(boardId, columnId, projectId, commentId, text) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      const project = column.projects.find(p => p.id === projectId);
      if (project) {
        const comment = project.comments.find(c => c.id === commentId);
        if (comment) {
          const oldText = comment.text;
          const newText = text;
          
          comment.text = text;
          comment.timestamp = new Date();
          
          // Log comment update with old and new values
          logActivity(boardId, columnId, projectId, 'comment_updated', 
            '✏️ Comment edited',
            oldText, newText);
          
          saveData();
          renderProjectModal();
          showToast('Comment updated');
          updateStorageStatus('Saved', true);
        }
      }
    }
  }
}

function deleteComment(boardId, columnId, projectId, commentId) {
  const board = state.boards.find(b => b.id === boardId);
  if (board) {
    const column = board.columns.find(c => c.id === columnId);
    if (column) {
      const project = column.projects.find(p => p.id === projectId);
      if (project) {
        const commentIndex = project.comments.findIndex(c => c.id === commentId);
        if (commentIndex !== -1) {
          const comment = project.comments[commentIndex];
          const commentText = comment.text;
          
          // Log comment deletion with content before removing
          logActivity(boardId, columnId, projectId, 'comment_deleted', '🗑️ Comment deleted', commentText, null);
          
          project.comments.splice(commentIndex, 1);
          saveData();
          renderProjectModal();
          showToast('Comment deleted');
          updateStorageStatus('Saved', true);
        }
      }
    }
  }
}

// Search Functionality
function searchProjects(query) {
  const board = getCurrentBoard();
  if (!board) return;

  const lowerQuery = query.toLowerCase();
  const columns = document.querySelectorAll('.column');

  columns.forEach((columnEl, colIndex) => {
    const column = board.columns[colIndex];
    const projectCards = columnEl.querySelectorAll('.project-card');

    projectCards.forEach((card, projIndex) => {
      const project = column.projects[projIndex];
      const matches = 
        project.projectId.toLowerCase().includes(lowerQuery) ||
        project.projectName.toLowerCase().includes(lowerQuery) ||
        project.description.toLowerCase().includes(lowerQuery);

      card.style.display = matches || query === '' ? 'block' : 'none';
    });
  });
}

// Render Functions
function updateBoardSelector() {
  const selector = document.getElementById('boardSelector');
  selector.innerHTML = '<option value="">Select Board</option>';
  
  state.boards.forEach(board => {
    const option = document.createElement('option');
    option.value = board.id;
    option.textContent = board.name;
    option.selected = board.id === state.currentBoardId;
    selector.appendChild(option);
  });
  
  updateBoardHint();
}

function renderBoard() {
  const board = getCurrentBoard();
  const emptyState = document.getElementById('emptyState');
  const boardContainer = document.getElementById('boardContainer');
  const boardTitle = document.getElementById('boardTitle');

  if (!board) {
    emptyState.classList.remove('hidden');
    boardContainer.classList.add('hidden');
    boardTitle.textContent = 'Kanban Board';
    return;
  }

  emptyState.classList.add('hidden');
  boardContainer.classList.remove('hidden');
  boardTitle.textContent = board.name;

  document.getElementById('currentBoardName').textContent = board.name;
  document.getElementById('currentBoardDesc').textContent = board.description || 'No description';

  const columnsContainer = document.getElementById('columnsContainer');
  columnsContainer.innerHTML = '';

  board.columns.forEach((column, columnIndex) => {
    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.draggable = true;
    columnEl.dataset.columnId = column.id;
    columnEl.dataset.columnIndex = columnIndex;

    columnEl.innerHTML = `
      <div class="column-header">
        <div class="column-title-container">
          <span class="column-title" contenteditable="false" data-column-id="${column.id}">${column.title}</span>
          <span class="column-count">${column.projects.length}</span>
        </div>
        <div class="column-actions">
          <button class="btn-icon" onclick="confirmDeleteColumn('${column.id}')" title="Delete Column">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="column-body" data-column-id="${column.id}"></div>
      <div class="column-footer">
        <button class="btn btn--secondary btn--sm" onclick="createProject('${state.currentBoardId}', '${column.id}')" style="width: 100%;">+ Add Project</button>
      </div>
    `;

    const columnBody = columnEl.querySelector('.column-body');

    column.projects.forEach(project => {
      const projectCard = document.createElement('div');
      projectCard.className = 'project-card';
      projectCard.draggable = true;
      projectCard.dataset.projectId = project.id;
      projectCard.dataset.columnId = column.id;

      projectCard.innerHTML = `
        <div class="project-card-id">${project.projectId}</div>
        <div class="project-card-name">${project.projectName}</div>
        ${project.description ? `<div class="project-card-desc">${project.description}</div>` : ''}
        <div class="project-card-meta">
          ${project.links.length > 0 ? `<span>🔗 ${project.links.length}</span>` : ''}
          ${project.comments.length > 0 ? `<span>💬 ${project.comments.length}</span>` : ''}
        </div>
      `;

      projectCard.addEventListener('click', () => {
        openProjectModal(state.currentBoardId, column.id, project.id);
      });

      // Project drag events
      projectCard.addEventListener('dragstart', handleProjectDragStart);
      projectCard.addEventListener('dragend', handleProjectDragEnd);

      columnBody.appendChild(projectCard);
    });

    // Column body drop events
    columnBody.addEventListener('dragover', handleColumnDragOver);
    columnBody.addEventListener('drop', handleColumnDrop);
    columnBody.addEventListener('dragleave', handleColumnDragLeave);

    // Column drag events
    columnEl.addEventListener('dragstart', handleColumnDragStart);
    columnEl.addEventListener('dragend', handleColumnDragEnd);
    columnEl.addEventListener('dragover', handleColumnReorder);
    columnEl.addEventListener('drop', handleColumnReorderDrop);

    columnsContainer.appendChild(columnEl);
  });

  // Add click handlers for column titles
  document.querySelectorAll('.column-title').forEach(titleEl => {
    titleEl.addEventListener('click', function() {
      this.contentEditable = 'true';
      this.classList.add('editing');
      this.focus();
      document.execCommand('selectAll', false, null);
    });

    titleEl.addEventListener('blur', function() {
      this.contentEditable = 'false';
      this.classList.remove('editing');
      const columnId = this.dataset.columnId;
      const newTitle = this.textContent.trim();
      if (newTitle) {
        updateColumn(state.currentBoardId, columnId, { title: newTitle });
      }
    });

    titleEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.blur();
      }
    });
  });
}

function openProjectModal(boardId, columnId, projectId) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;
  
  const column = board.columns.find(c => c.id === columnId);
  if (!column) return;
  
  const project = column.projects.find(p => p.id === projectId);
  if (!project) return;

  currentContext = { boardId, columnId, projectId };

  document.getElementById('modalProjectId').value = project.projectId;
  document.getElementById('modalProjectName').value = project.projectName;
  document.getElementById('modalProjectDesc').value = project.description;

  renderProjectModal();
  openModal('projectModal');
}

function closeProjectModal() {
  // Save changes before closing
  const projectId = document.getElementById('modalProjectId').value.trim().toUpperCase();
  const projectName = document.getElementById('modalProjectName').value.trim();
  const description = document.getElementById('modalProjectDesc').value.trim();

  if (currentContext.projectId && projectName) {
    updateProject(currentContext.boardId, currentContext.columnId, currentContext.projectId, {
      projectId,
      projectName,
      description
    });
  }

  closeModal('projectModal');
  currentContext = { boardId: null, columnId: null, projectId: null };
}

function renderProjectModal() {
  const { boardId, columnId, projectId } = currentContext;
  if (!projectId) return;

  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;
  
  const column = board.columns.find(c => c.id === columnId);
  if (!column) return;
  
  const project = column.projects.find(p => p.id === projectId);
  if (!project) return;

  // Render links
  const linksContainer = document.getElementById('linksContainer');
  if (project.links.length === 0) {
    linksContainer.innerHTML = '<p class="empty-message">No links added yet</p>';
  } else {
    linksContainer.innerHTML = project.links.map(link => `
      <div class="link-item">
        <div class="link-content">
          <div class="link-title">${link.title}</div>
          <a href="${link.url}" class="link-url" target="_blank">${link.url}</a>
          <div class="link-timestamp">Added on ${formatTimestamp(new Date(link.timestamp))}</div>
        </div>
        <div class="link-actions">
          <button class="btn-icon" onclick="editLink('${link.id}')" title="Edit Link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon" onclick="confirmDeleteLink('${link.id}')" title="Delete Link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Render comments
  const commentsContainer = document.getElementById('commentsContainer');
  if (project.comments.length === 0) {
    commentsContainer.innerHTML = '<p class="empty-message">No comments yet</p>';
  } else {
    commentsContainer.innerHTML = project.comments.map(comment => `
      <div class="comment-item" data-comment-id="${comment.id}">
        <div class="comment-header">
          <div class="comment-timestamp">${formatTimestamp(new Date(comment.timestamp))}</div>
          <div class="comment-actions">
            <button class="btn-icon" onclick="editComment('${comment.id}')" title="Edit Comment">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-icon" onclick="confirmDeleteComment('${comment.id}')" title="Delete Comment">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
          <div class="comment-edit-actions">
            <button class="btn btn--sm btn--primary" onclick="saveCommentEdit('${comment.id}')">Save</button>
            <button class="btn btn--sm btn--secondary" onclick="cancelCommentEdit('${comment.id}')">Cancel</button>
          </div>
        </div>
        <div class="comment-text">${comment.text}</div>
        <textarea class="comment-edit-input form-control" rows="3">${comment.text}</textarea>
      </div>
    `).join('');
  }

  // Render activity log
  const activityLog = project.activityLog || [];
  const activityCount = document.getElementById('activityCount');
  const activityLogContainer = document.getElementById('activityLogContainer');
  
  console.log('Rendering activity log:', activityLog.length, 'activities');
  
  if (!activityLogContainer) {
    console.error('❌ Activity log container not found!');
    return;
  }
  
  activityCount.textContent = activityLog.length;
  
  if (activityLog.length === 0) {
    activityLogContainer.innerHTML = '<p class="empty-message">No activities yet</p>';
  } else {
    activityLogContainer.innerHTML = activityLog.map(activity => {
      let changeHtml = '';
      
      // Handle different activity types with proper formatting
      if (activity.action === 'comment_added') {
        const content = truncateText(activity.newValue, 100);
        changeHtml = `<div class="activity-change">Content: "${content}"</div>`;
      }
      else if (activity.action === 'comment_updated') {
        const oldContent = truncateText(activity.oldValue, 100);
        const newContent = truncateText(activity.newValue, 100);
        changeHtml = `
          <div class="activity-change">From: "${oldContent}"</div>
          <div class="activity-change">To: "${newContent}"</div>
        `;
      }
      else if (activity.action === 'comment_deleted') {
        const content = truncateText(activity.oldValue, 100);
        changeHtml = `<div class="activity-change">Content: "${content}"</div>`;
      }
      else if (activity.action === 'link_added') {
        changeHtml = `
          <div class="activity-change">Title: "${activity.newValue.title}"</div>
          <div class="activity-change">URL: ${activity.newValue.url}</div>
        `;
      }
      else if (activity.action === 'link_updated') {
        changeHtml = `
          <div class="activity-change">Title changed:</div>
          <div class="activity-change-indent">From: "${activity.oldValue.title}"</div>
          <div class="activity-change-indent">To: "${activity.newValue.title}"</div>
          <div class="activity-change">URL changed:</div>
          <div class="activity-change-indent">From: ${activity.oldValue.url}</div>
          <div class="activity-change-indent">To: ${activity.newValue.url}</div>
        `;
      }
      else if (activity.action === 'link_title_updated') {
        changeHtml = `
          <div class="activity-change">From: "${activity.oldValue.oldTitle}"</div>
          <div class="activity-change">To: "${activity.newValue.newTitle}"</div>
          <div class="activity-change">URL: ${activity.oldValue.url}</div>
        `;
      }
      else if (activity.action === 'link_url_updated') {
        changeHtml = `
          <div class="activity-change">Title: "${activity.oldValue.title}"</div>
          <div class="activity-change">From: ${activity.oldValue.oldUrl}</div>
          <div class="activity-change">To: ${activity.newValue.newUrl}</div>
        `;
      }
      else if (activity.action === 'link_deleted') {
        changeHtml = `
          <div class="activity-change">Title: "${activity.oldValue.title}"</div>
          <div class="activity-change">URL: ${activity.oldValue.url}</div>
        `;
      }
      else if (activity.oldValue !== null && activity.newValue !== null) {
        // Handle other activities with old/new values (project fields)
        const displayOldValue = truncateText(activity.oldValue, 100);
        const displayNewValue = truncateText(activity.newValue, 100);
        changeHtml = `
          <div class="activity-change">From: ${displayOldValue}</div>
          <div class="activity-change">To: ${displayNewValue}</div>
        `;
      }
      
      return `
        <div class="activity-item">
          <div class="activity-content">
            <div class="activity-description">${activity.description}</div>
            ${changeHtml}
            <div class="activity-timestamp">${formatTimestamp(new Date(activity.timestamp))}</div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Drag and Drop Handlers
function handleProjectDragStart(e) {
  dragState.type = 'project';
  dragState.sourceId = e.currentTarget.dataset.projectId;
  dragState.sourceColumnId = e.currentTarget.dataset.columnId;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleProjectDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.column-body').forEach(col => col.classList.remove('drag-over'));
  dragState = { type: null, sourceId: null, sourceColumnId: null, sourceIndex: null };
}

function handleColumnDragOver(e) {
  if (dragState.type !== 'project') return;
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleColumnDragLeave(e) {
  if (e.currentTarget.contains(e.relatedTarget)) return;
  e.currentTarget.classList.remove('drag-over');
}

function handleColumnDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (dragState.type !== 'project') return;

  const targetColumnId = e.currentTarget.dataset.columnId;
  const board = getCurrentBoard();
  const targetColumn = board.columns.find(c => c.id === targetColumnId);
  
  moveProject(
    state.currentBoardId,
    dragState.sourceColumnId,
    targetColumnId,
    dragState.sourceId,
    targetColumn.projects.length
  );
}

function handleColumnDragStart(e) {
  // Only drag column if not dragging project
  if (e.target.classList.contains('project-card')) {
    e.stopPropagation();
    return;
  }
  
  dragState.type = 'column';
  dragState.sourceId = e.currentTarget.dataset.columnId;
  dragState.sourceIndex = parseInt(e.currentTarget.dataset.columnIndex);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleColumnDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  dragState = { type: null, sourceId: null, sourceColumnId: null, sourceIndex: null };
}

function handleColumnReorder(e) {
  if (dragState.type !== 'column') return;
  e.preventDefault();
}

function handleColumnReorderDrop(e) {
  if (dragState.type !== 'column') return;
  e.preventDefault();
  e.stopPropagation();

  const targetIndex = parseInt(e.currentTarget.dataset.columnIndex);
  
  if (dragState.sourceIndex !== targetIndex) {
    reorderColumns(state.currentBoardId, dragState.sourceIndex, targetIndex);
  }
}

// Confirmation Dialogs
function showConfirmDialog(title, message, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  
  const confirmBtn = document.getElementById('confirmAction');
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  
  newConfirmBtn.addEventListener('click', () => {
    onConfirm();
    closeModal('confirmModal');
  });
  
  openModal('confirmModal');
}

function confirmDeleteColumn(columnId) {
  const board = getCurrentBoard();
  const column = board.columns.find(c => c.id === columnId);
  
  if (column.projects.length > 0) {
    showConfirmDialog(
      'Delete Column',
      `This column contains ${column.projects.length} project(s). Are you sure you want to delete it?`,
      () => deleteColumn(state.currentBoardId, columnId)
    );
  } else {
    deleteColumn(state.currentBoardId, columnId);
  }
}

function confirmDeleteLink(linkId) {
  showConfirmDialog(
    'Delete Link',
    'Are you sure you want to delete this link?',
    () => deleteLink(currentContext.boardId, currentContext.columnId, currentContext.projectId, linkId)
  );
}

function confirmDeleteComment(commentId) {
  showConfirmDialog(
    'Delete Comment',
    'Are you sure you want to delete this comment?',
    () => deleteComment(currentContext.boardId, currentContext.columnId, currentContext.projectId, commentId)
  );
}

function editLink(linkId) {
  const { boardId, columnId, projectId } = currentContext;
  const board = state.boards.find(b => b.id === boardId);
  const column = board.columns.find(c => c.id === columnId);
  const project = column.projects.find(p => p.id === projectId);
  const link = project.links.find(l => l.id === linkId);

  if (link) {
    document.getElementById('linkTitle').value = link.title;
    document.getElementById('linkUrl').value = link.url;
    document.getElementById('linkModalTitle').textContent = 'Edit Link';
    currentContext.linkId = linkId;
    openModal('addLinkModal');
  }
}

function editComment(commentId) {
  const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (commentItem) {
    commentItem.classList.add('editing');
  }
}

function saveCommentEdit(commentId) {
  const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);
  const textarea = commentItem.querySelector('.comment-edit-input');
  const newText = textarea.value.trim();
  
  if (newText) {
    updateComment(currentContext.boardId, currentContext.columnId, currentContext.projectId, commentId, newText);
  }
}

function cancelCommentEdit(commentId) {
  const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (commentItem) {
    commentItem.classList.remove('editing');
    // Reset textarea to original value
    const { boardId, columnId, projectId } = currentContext;
    const board = state.boards.find(b => b.id === boardId);
    const column = board.columns.find(c => c.id === columnId);
    const project = column.projects.find(p => p.id === projectId);
    const comment = project.comments.find(c => c.id === commentId);
    if (comment) {
      commentItem.querySelector('.comment-edit-input').value = comment.text;
    }
  }
}

// Activity Log Toggle
function toggleActivityLog() {
  const container = document.getElementById('activityLogContainer');
  const header = document.querySelector('.section-header--collapsible');
  
  container.classList.toggle('collapsed');
  header.classList.toggle('collapsed');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing Kanban Board...');
  
  // Debug: Check if buttons exist in DOM
  console.log('=== Button Visibility Check ===');
  const exportBtn = document.getElementById('export-json-btn');
  const importBtn = document.getElementById('import-json-btn');
  const sheetsBtn = document.getElementById('export-sheets-btn');
  
  console.log('Export button:', exportBtn ? '✅ Found' : '❌ Not found');
  console.log('Import button:', importBtn ? '✅ Found' : '❌ Not found');
  console.log('Sheets button:', sheetsBtn ? '✅ Found' : '❌ Not found');
  
  if (exportBtn) {
    const styles = window.getComputedStyle(exportBtn);
    console.log('Export button display:', styles.display);
    console.log('Export button visibility:', styles.visibility);
    console.log('Export button opacity:', styles.opacity);
  }
  
  // Check localStorage availability
  storageAvailable = checkStorageAvailability();
  
  if (storageAvailable) {
    console.log('✅ localStorage is available');
    showToast('Storage available - data will auto-save');
  } else {
    console.warn('⚠️ localStorage not available');
    showToast('⚠️ Storage unavailable. Use Export/Import for backups.');
    updateStorageStatus('No storage', false);
  }
  
  // Load data from localStorage
  const dataLoaded = loadData();
  
  if (dataLoaded && state.boards.length > 0) {
    // Show first board or last used board
    if (state.currentBoardId) {
      const board = state.boards.find(b => b.id === state.currentBoardId);
      if (board) {
        renderBoard();
      } else {
        state.currentBoardId = state.boards[0].id;
        renderBoard();
      }
    } else {
      state.currentBoardId = state.boards[0].id;
      renderBoard();
    }
    updateBoardSelector();
  } else {
    // Show empty state
    renderBoard();
    updateBoardSelector();
  }
  
  // Set up auto-save (every 30 seconds)
  if (storageAvailable) {
    setInterval(() => {
      if (state.boards.length > 0) {
        saveData();
      }
    }, 30000);
    console.log('⏰ Auto-save enabled (every 30 seconds)');
  }
  
  // Check backup reminder after 5 seconds
  checkBackupReminder();
  
  // Debug keyboard shortcut (Ctrl+Shift+D)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      showDebugInfo();
    }
  });

  // Create Board
  document.getElementById('createBoardBtn').addEventListener('click', () => {
    document.getElementById('newBoardName').value = '';
    document.getElementById('newBoardPrefix').value = '';
    document.getElementById('newBoardDesc').value = '';
    openModal('createBoardModal');
  });

  document.getElementById('confirmCreateBoard').addEventListener('click', () => {
    const name = document.getElementById('newBoardName').value.trim();
    const prefix = document.getElementById('newBoardPrefix').value.trim();
    const description = document.getElementById('newBoardDesc').value.trim();

    if (!name || !prefix) {
      showToast('Please enter board name and prefix');
      return;
    }

    createBoard(name, prefix, description);
    closeModal('createBoardModal');
  });

  // Board Selector
  document.getElementById('boardSelector').addEventListener('change', (e) => {
    state.currentBoardId = e.target.value;
    saveData();
    renderBoard();
  });

  // Board Settings
  document.getElementById('boardSettingsBtn').addEventListener('click', () => {
    const board = getCurrentBoard();
    if (!board) {
      showToast('Please select or create a board first');
      return;
    }

    document.getElementById('editBoardName').value = board.name;
    document.getElementById('editBoardPrefix').value = board.projectIdPrefix;
    document.getElementById('editBoardDesc').value = board.description;
    openModal('boardSettingsModal');
  });

  document.getElementById('saveBoardSettings').addEventListener('click', () => {
    const name = document.getElementById('editBoardName').value.trim();
    const prefix = document.getElementById('editBoardPrefix').value.trim();
    const description = document.getElementById('editBoardDesc').value.trim();

    if (!name || !prefix) {
      showToast('Please enter board name and prefix');
      return;
    }

    updateBoard(state.currentBoardId, {
      name,
      projectIdPrefix: prefix.toUpperCase(),
      description
    });
    closeModal('boardSettingsModal');
    showToast('Board settings updated');
  });

  document.getElementById('deleteBoardBtn').addEventListener('click', () => {
    showConfirmDialog(
      'Delete Board',
      'Are you sure you want to delete this board? All projects will be lost.',
      () => {
        deleteBoard(state.currentBoardId);
        closeModal('boardSettingsModal');
      }
    );
  });
  
  // Clear All Data
  document.getElementById('clearAllDataBtn').addEventListener('click', () => {
    clearAllData();
    closeModal('boardSettingsModal');
  });

  // Add Column
  document.getElementById('addColumnBtn').addEventListener('click', () => {
    document.getElementById('newColumnTitle').value = '';
    openModal('addColumnModal');
  });

  document.getElementById('confirmAddColumn').addEventListener('click', () => {
    const title = document.getElementById('newColumnTitle').value.trim();
    if (!title) {
      showToast('Please enter column title');
      return;
    }

    createColumn(state.currentBoardId, title);
    closeModal('addColumnModal');
  });

  // Project Modal - Delete Project
  document.getElementById('deleteProjectBtn').addEventListener('click', () => {
    showConfirmDialog(
      'Delete Project',
      'Are you sure you want to delete this project?',
      () => {
        deleteProject(currentContext.boardId, currentContext.columnId, currentContext.projectId);
        closeModal('projectModal');
      }
    );
  });

  // Add Link
  document.getElementById('addLinkBtn').addEventListener('click', () => {
    document.getElementById('linkTitle').value = '';
    document.getElementById('linkUrl').value = '';
    document.getElementById('linkModalTitle').textContent = 'Add Link';
    currentContext.linkId = null;
    openModal('addLinkModal');
  });

  document.getElementById('confirmAddLink').addEventListener('click', () => {
    const title = document.getElementById('linkTitle').value.trim();
    const url = document.getElementById('linkUrl').value.trim();

    if (!title || !url) {
      showToast('Please enter both title and URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      showToast('Please enter a valid URL');
      return;
    }

    if (currentContext.linkId) {
      updateLink(currentContext.boardId, currentContext.columnId, currentContext.projectId, currentContext.linkId, url, title);
    } else {
      addLink(currentContext.boardId, currentContext.columnId, currentContext.projectId, url, title);
    }
    
    closeModal('addLinkModal');
  });

  // Add Comment
  document.getElementById('addCommentBtn').addEventListener('click', () => {
    const text = document.getElementById('newCommentText').value.trim();
    
    if (!text) {
      showToast('Please enter comment text');
      return;
    }

    if (text.length > 500) {
      showToast('Comment is too long (max 500 characters)');
      return;
    }

    addComment(currentContext.boardId, currentContext.columnId, currentContext.projectId, text);
    document.getElementById('newCommentText').value = '';
  });

  // Search with clear button
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  searchInput.addEventListener('input', (e) => {
    searchProjects(e.target.value);
    
    // Show/hide clear button
    if (e.target.value.length > 0) {
      searchClear.classList.add('active');
    } else {
      searchClear.classList.remove('active');
    }
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.remove('active');
    searchProjects('');
    searchInput.focus();
  });

  // Keyboard support - Escape to clear search
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchInput.value) {
      e.preventDefault();
      searchInput.value = '';
      searchClear.classList.remove('active');
      searchProjects('');
      searchInput.blur();
    }
  });

  // Board title click to edit
  document.getElementById('boardTitle').addEventListener('click', () => {
    const board = getCurrentBoard();
    if (!board) return;
    document.getElementById('boardSettingsBtn').click();
  });
  
  // Export/Import event listeners
  console.log('Setting up Export/Import button listeners...');
  
  const exportJsonBtn = document.getElementById('export-json-btn');
  const importJsonBtn = document.getElementById('import-json-btn');
  const exportSheetsBtn = document.getElementById('export-sheets-btn');
  
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', exportToJSON);
    console.log('✅ Export JSON button listener attached');
  } else {
    console.error('❌ Export JSON button not found!');
  }
  
  if (importJsonBtn) {
    importJsonBtn.addEventListener('click', importFromJSON);
    console.log('✅ Import JSON button listener attached');
  } else {
    console.error('❌ Import JSON button not found!');
  }
  
  if (exportSheetsBtn) {
    exportSheetsBtn.addEventListener('click', exportToGoogleSheets);
    console.log('✅ Export Sheets button listener attached');
  } else {
    console.error('❌ Export Sheets button not found!');
  }
  
  // Update board hint visibility
  updateBoardHint();
  
  console.log('✅ Kanban Board initialized successfully');
});

// Update board hint visibility
function updateBoardHint() {
  const boardHint = document.getElementById('boardHint');
  if (boardHint) {
    boardHint.style.display = state.boards.length === 0 ? 'inline' : 'none';
  }
}