const { useState, useEffect, useRef } = React;

// Initial data structure with Jira-like features
const initialBoards = [
  {
    id: '1',
    name: 'My First Project',
    projectId: 'PROJ',
    description: 'This is your first project. Click settings to edit project details.',
    projectLinks: [],
    projectComments: [],
    columns: [
      { id: 'col-1', title: 'To Do', projects: [] },
      { id: 'col-2', title: 'In Progress', projects: [] },
      { id: 'col-3', title: 'Done', projects: [] }
    ]
  }
];

// In-memory storage for state management
// NOTE: Data will not persist on page reload in this preview
const memoryStorage = {};

const storage = {
  get: (key, defaultValue) => {
    return memoryStorage[key] !== undefined ? memoryStorage[key] : defaultValue;
  },
  set: (key, value) => {
    memoryStorage[key] = value;
  }
};

function App() {
  const [boards, setBoards] = useState(() => storage.get('kanban-boards', initialBoards));
  const [currentBoardId, setCurrentBoardId] = useState(() => storage.get('current-board-id', '1'));
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(null);
  const [modalData, setModalData] = useState({});

  // Save to storage whenever boards change
  useEffect(() => {
    storage.set('kanban-boards', boards);
  }, [boards]);

  useEffect(() => {
    storage.set('current-board-id', currentBoardId);
  }, [currentBoardId]);

  const currentBoard = boards.find(b => b.id === currentBoardId);

  // Board operations
  const createBoard = (name, projectId) => {
    const newBoard = {
      id: Date.now().toString(),
      name,
      projectId: projectId || 'PROJ',
      description: '',
      projectLinks: [],
      projectComments: [],
      columns: [
        { id: `col-${Date.now()}-1`, title: 'To Do', cards: [] },
        { id: `col-${Date.now()}-2`, title: 'In Progress', cards: [] },
        { id: `col-${Date.now()}-3`, title: 'Done', cards: [] }
      ]
    };
    setBoards([...boards, newBoard]);
    setCurrentBoardId(newBoard.id);
    setShowModal(null);
  };

  const deleteBoard = (boardId) => {
    const updatedBoards = boards.filter(b => b.id !== boardId);
    setBoards(updatedBoards);
    if (currentBoardId === boardId) {
      setCurrentBoardId(updatedBoards[0]?.id || null);
    }
  };

  const editBoard = (boardId, updates) => {
    setBoards(boards.map(b => b.id === boardId ? { ...b, ...updates } : b));
    setShowModal(null);
  };

  // Column operations
  const createColumn = (title) => {
    const newColumn = {
      id: `col-${Date.now()}`,
      title,
      projects: []
    };
    setBoards(boards.map(b => 
      b.id === currentBoardId 
        ? { ...b, columns: [...b.columns, newColumn] }
        : b
    ));
    setShowModal(null);
  };

  const editColumn = (columnId, title) => {
    setBoards(boards.map(b => 
      b.id === currentBoardId
        ? {
            ...b,
            columns: b.columns.map(col => 
              col.id === columnId ? { ...col, title } : col
            )
          }
        : b
    ));
    setShowModal(null);
  };

  const deleteColumn = (columnId) => {
    setBoards(boards.map(b => 
      b.id === currentBoardId
        ? { ...b, columns: b.columns.filter(col => col.id !== columnId) }
        : b
    ));
  };

  // Project operations
  const createProject = (columnId, project) => {
    const projectCount = currentBoard.columns.reduce((count, col) => count + col.projects.length, 0) + 1;
    const newProject = {
      id: `project-${Date.now()}`,
      projectId: project.projectId || `${currentBoard.projectId}-${projectCount}`,
      projectName: project.projectName,
      description: project.description || '',
      comments: project.comments || [],
      links: project.links || [],
      createdAt: new Date().toISOString()
    };
    setBoards(boards.map(b => 
      b.id === currentBoardId
        ? {
            ...b,
            columns: b.columns.map(col => 
              col.id === columnId
                ? { ...col, projects: [...col.projects, newProject] }
                : col
            )
          }
        : b
    ));
    setShowModal(null);
  };

  const editProject = (columnId, projectId, updatedProject) => {
    setBoards(boards.map(b => 
      b.id === currentBoardId
        ? {
            ...b,
            columns: b.columns.map(col => 
              col.id === columnId
                ? {
                    ...col,
                    projects: col.projects.map(project => 
                      project.id === projectId ? { ...project, ...updatedProject } : project
                    )
                  }
                : col
            )
          }
        : b
    ));
    setShowModal(null);
  };

  const deleteProject = (columnId, projectId) => {
    setBoards(boards.map(b => 
      b.id === currentBoardId
        ? {
            ...b,
            columns: b.columns.map(col => 
              col.id === columnId
                ? { ...col, projects: col.projects.filter(project => project.id !== projectId) }
                : col
            )
          }
        : b
    ));
  };

  const moveProject = (projectId, fromColumnId, toColumnId) => {
    let movedProject = null;
    
    setBoards(boards.map(b => {
      if (b.id !== currentBoardId) return b;
      
      // Remove project from source column
      const updatedColumns = b.columns.map(col => {
        if (col.id === fromColumnId) {
          movedProject = col.projects.find(project => project.id === projectId);
          return { ...col, projects: col.projects.filter(project => project.id !== projectId) };
        }
        return col;
      });
      
      // Add project to destination column
      return {
        ...b,
        columns: updatedColumns.map(col => 
          col.id === toColumnId && movedProject
            ? { ...col, projects: [...col.projects, movedProject] }
            : col
        )
      };
    }));
  };

  // Filter projects based on search
  const filterProjects = (projects) => {
    if (!searchTerm) return projects;
    const term = searchTerm.toLowerCase();
    return projects.filter(project => 
      project.projectName?.toLowerCase().includes(term) ||
      project.projectId?.toLowerCase().includes(term) ||
      project.description?.toLowerCase().includes(term)
    );
  };

  return (
    <div className="app">
      <Header
        boards={boards}
        currentBoardId={currentBoardId}
        setCurrentBoardId={setCurrentBoardId}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onCreateBoard={() => setShowModal('createBoard')}
        onBoardSettings={() => {
          setModalData({ board: currentBoard });
          setShowModal('boardSettings');
        }}
        onDeleteBoard={() => {
          if (confirm('Are you sure you want to delete this board?')) {
            deleteBoard(currentBoardId);
          }
        }}
      />
      
      {currentBoard ? (
        <BoardView
          board={currentBoard}
          searchTerm={searchTerm}
          filterProjects={filterProjects}
          onCreateColumn={() => setShowModal('createColumn')}
          onEditColumn={(columnId, title) => {
            setModalData({ columnId, title });
            setShowModal('editColumn');
          }}
          onDeleteColumn={deleteColumn}
          onCreateProject={(columnId) => {
            setModalData({ columnId });
            setShowModal('createProject');
          }}
          onEditProject={(columnId, project) => {
            setModalData({ columnId, project });
            setShowModal('editProject');
          }}
          onDeleteProject={deleteProject}
          onMoveProject={moveProject}
        />
      ) : (
        <WelcomeScreen onCreateBoard={() => setShowModal('createBoard')} />
      )}

      {showModal === 'createBoard' && (
        <BoardModal
          onClose={() => setShowModal(null)}
          onSave={createBoard}
          title="Create New Board"
        />
      )}

      {showModal === 'boardSettings' && (
        <BoardSettingsModal
          onClose={() => setShowModal(null)}
          board={modalData.board}
          onSave={(updates) => editBoard(modalData.board.id, updates)}
        />
      )}

      {showModal === 'createColumn' && (
        <ColumnModal
          onClose={() => setShowModal(null)}
          onSave={createColumn}
          title="Create New Column"
        />
      )}

      {showModal === 'editColumn' && (
        <ColumnModal
          onClose={() => setShowModal(null)}
          onSave={(title) => editColumn(modalData.columnId, title)}
          title="Edit Column"
          initialTitle={modalData.title}
        />
      )}

      {showModal === 'createProject' && (
        <ProjectModal
          onClose={() => setShowModal(null)}
          onSave={(project) => createProject(modalData.columnId, project)}
          title="Create New Project"
          boardProjectId={currentBoard.projectId}
        />
      )}

      {showModal === 'editProject' && (
        <ProjectModal
          onClose={() => setShowModal(null)}
          onSave={(project) => editProject(modalData.columnId, modalData.project.id, project)}
          onDelete={() => {
            deleteProject(modalData.columnId, modalData.project.id);
            setShowModal(null);
          }}
          title="Project Details"
          initialProject={modalData.project}
          boardProjectId={currentBoard.projectId}
        />
      )}
    </div>
  );
}

function Header({ boards, currentBoardId, setCurrentBoardId, searchTerm, setSearchTerm, onCreateBoard, onBoardSettings }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span>📋</span>
          <span>Project Kanban</span>
        </div>
        <div className="board-selector">
          <select 
            className="board-select"
            value={currentBoardId || ''}
            onChange={(e) => setCurrentBoardId(e.target.value)}
          >
            {boards.map(board => (
              <option key={board.id} value={board.id}>{board.name}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-small" onClick={onCreateBoard}>
            + New Board
          </button>
          {currentBoardId && (
            <button className="btn btn-secondary btn-small" onClick={onBoardSettings}>
              ⚙️ Board Settings
            </button>
          )}
        </div>
      </div>
      <div className="search-box">
        <input
          type="text"
          className="search-input"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </header>
  );
}

function BoardView({ board, searchTerm, filterProjects, onCreateColumn, onEditColumn, onDeleteColumn, onCreateProject, onEditProject, onDeleteProject, onMoveProject }) {
  const totalProjects = board.columns.reduce((sum, col) => sum + col.projects.length, 0);
  
  return (
    <div className="board-view">
      <div className="project-header">
        <div className="project-info">
          <div className="project-name">{board.name}</div>
          <div className="project-id">Board Key: {board.projectId}</div>
        </div>
        <div className="stats-bar">
          <div className="stat-item">
            <span>📊</span>
            <span className="stat-value">{totalProjects}</span>
            <span>Total Projects</span>
          </div>
          {board.columns.map(col => (
            <div key={col.id} className="stat-item">
              <span className="stat-value">{col.projects.length}</span>
              <span>{col.title}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="columns-container">
        {board.columns.map(column => (
          <Column
            key={column.id}
            column={column}
            projects={filterProjects(column.projects)}
            onEditColumn={onEditColumn}
            onDeleteColumn={onDeleteColumn}
            onCreateProject={onCreateProject}
            onEditProject={onEditProject}
            onDeleteProject={onDeleteProject}
            onMoveProject={onMoveProject}
          />
        ))}
        <button className="add-column-btn" onClick={onCreateColumn}>
          + Add Column
        </button>
      </div>
    </div>
  );
}

function Column({ column, projects, onEditColumn, onDeleteColumn, onCreateProject, onEditProject, onDeleteProject, onMoveProject }) {
  const [draggedOver, setDraggedOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDraggedOver(true);
  };

  const handleDragLeave = () => {
    setDraggedOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDraggedOver(false);
    const data = JSON.parse(e.dataTransfer.getData('project'));
    if (data.columnId !== column.id) {
      onMoveProject(data.projectId, data.columnId, column.id);
    }
  };

  return (
    <div 
      className="column"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={draggedOver ? { backgroundColor: 'rgba(33, 128, 141, 0.05)' } : {}}
    >
      <div className="column-header">
        <div className="column-title">
          {column.title}
          <span className="column-count">{projects.length}</span>
        </div>
        <div className="column-actions">
          <button className="icon-btn" onClick={() => onEditColumn(column.id, column.title)} title="Edit column">
            ✏️
          </button>
          <button className="icon-btn" onClick={() => {
            if (confirm('Delete this column and all its projects?')) {
              onDeleteColumn(column.id);
            }
          }} title="Delete column">
            🗑️
          </button>
        </div>
      </div>
      <div className="cards-container">
        {projects.length === 0 ? (
          <div className="empty-state">No projects yet</div>
        ) : (
          projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              columnId={column.id}
              onEdit={() => onEditProject(column.id, project)}
              onDelete={() => {
                if (confirm('Delete this project?')) {
                  onDeleteProject(column.id, project.id);
                }
              }}
            />
          ))
        )}
      </div>
      <button className="add-card-btn" onClick={() => onCreateProject(column.id)}>
        + Add Project
      </button>
    </div>
  );
}

function ProjectCard({ project, columnId, onEdit, onDelete }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('project', JSON.stringify({ projectId: project.id, columnId }));
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  return (
    <div
      className="card"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onEdit}
    >
      <div className="card-key">{project.projectId}</div>
      <div className="card-title">{project.projectName}</div>
      {project.description && (
        <div className="card-description">{project.description}</div>
      )}
      <div className="card-badges">
        {project.comments && project.comments.length > 0 && (
          <span className="badge">💬 {project.comments.length}</span>
        )}
        {project.links && project.links.length > 0 && (
          <span className="badge">🔗 {project.links.length}</span>
        )}
      </div>
    </div>
  );
}

function WelcomeScreen({ onCreateBoard }) {
  return (
    <div className="welcome-screen">
      <h1 className="welcome-title">Welcome to Project Kanban</h1>
      <p className="welcome-subtitle">Create your first board to get started</p>
      <button className="btn btn-primary" onClick={onCreateBoard}>
        + Create Board
      </button>
    </div>
  );
}

function BoardModal({ onClose, onSave, title, initialName = '', initialProjectId = '' }) {
  const [name, setName] = useState(initialName);
  const [projectId, setProjectId] = useState(initialProjectId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), projectId.trim() || 'PROJ');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Board Name *</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter board name"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Default Project ID Prefix *</label>
            <input
              type="text"
              className="form-input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value.toUpperCase())}
              placeholder="e.g., PROJ, DEV"
              maxLength="10"
              required
            />
            <small style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              This prefix will be used for auto-generating project IDs
            </small>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ColumnModal({ onClose, onSave, title, initialTitle = '' }) {
  const [columnTitle, setColumnTitle] = useState(initialTitle);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (columnTitle.trim()) {
      onSave(columnTitle.trim());
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Column Title</label>
            <input
              type="text"
              className="form-input"
              value={columnTitle}
              onChange={(e) => setColumnTitle(e.target.value)}
              placeholder="Enter column title"
              autoFocus
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectModal({ onClose, onSave, onDelete, title, initialProject = {}, boardProjectId = 'PROJ' }) {
  const projectCount = Date.now() % 1000;
  const [project, setProject] = useState({
    projectName: initialProject.projectName || '',
    projectId: initialProject.projectId || `${boardProjectId}-${projectCount}`,
    description: initialProject.description || '',
    comments: initialProject.comments || [],
    links: initialProject.links || []
  });
  const [commentInput, setCommentInput] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (project.projectName.trim()) {
      onSave(project);
    }
  };

  const addComment = () => {
    if (commentInput.trim() && commentAuthor.trim()) {
      const newComment = {
        id: Date.now().toString(),
        text: commentInput.trim(),
        author: commentAuthor.trim(),
        timestamp: new Date().toISOString()
      };
      setProject({ ...project, comments: [...project.comments, newComment] });
      setCommentInput('');
    }
  };

  const removeComment = (commentId) => {
    setProject({ ...project, comments: project.comments.filter(c => c.id !== commentId) });
  };

  const addLink = () => {
    if (linkLabel.trim() && linkUrl.trim()) {
      const newLink = {
        id: Date.now().toString(),
        label: linkLabel.trim(),
        url: linkUrl.trim()
      };
      setProject({ ...project, links: [...project.links, newLink] });
      setLinkLabel('');
      setLinkUrl('');
    }
  };

  const removeLink = (linkId) => {
    setProject({ ...project, links: project.links.filter(l => l.id !== linkId) });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Details Section */}
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input
              type="text"
              className="form-input"
              value={project.projectName}
              onChange={(e) => setProject({ ...project, projectName: e.target.value })}
              placeholder="Enter project name"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Project ID *</label>
            <input
              type="text"
              className="form-input"
              value={project.projectId}
              onChange={(e) => setProject({ ...project, projectId: e.target.value.toUpperCase()})}
              placeholder="e.g., PROJ-001"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={project.description}
              onChange={(e) => setProject({ ...project, description: e.target.value })}
              placeholder="Enter project description"
              rows="4"
            />
          </div>
          
          {/* Links Section */}
          <div className="links-section" style={{ marginTop: 'var(--space-24)', paddingTop: 'var(--space-24)', borderTop: '2px solid var(--color-border)' }}>
            <h4 className="section-title">🔗 Links ({project.links.length})</h4>
            {project.links.map(link => (
              <div key={link.id} className="link-item">
                <div className="link-header">
                  <div style={{ flex: 1 }}>
                    <div className="link-label">{link.label}</div>
                    <a href={link.url} className="link-url" target="_blank" rel="noopener noreferrer">
                      {link.url}
                    </a>
                  </div>
                  <button 
                    type="button"
                    className="icon-btn" 
                    onClick={() => removeLink(link.id)}
                    title="Delete link"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
            
            <div className="add-link-form">
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Link label (e.g., Design Doc, GitHub)"
                />
              </div>
              <div className="input-group">
                <input
                  type="url"
                  className="form-input"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />
                <button type="button" className="btn btn-secondary" onClick={addLink}>
                  Add Link
                </button>
              </div>
            </div>
          </div>
          
          {/* Comments Section */}
          <div className="comments-section" style={{ marginTop: 'var(--space-24)', paddingTop: 'var(--space-24)', borderTop: '2px solid var(--color-border)' }}>
            <h4 className="section-title">💬 Comments ({project.comments.length})</h4>
            {project.comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-header">
                  <div>
                    <div className="comment-author">{comment.author}</div>
                    <div className="comment-time">
                      {new Date(comment.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <button 
                    type="button"
                    className="icon-btn" 
                    onClick={() => removeComment(comment.id)}
                    title="Delete comment"
                  >
                    🗑️
                  </button>
                </div>
                <div className="comment-text">{comment.text}</div>
              </div>
            ))}
            
            <div className="add-comment-form">
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="input-group">
                <textarea
                  className="form-textarea"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Write a comment..."
                  rows="3"
                />
                <button type="button" className="btn btn-secondary" onClick={addComment}>
                  Post Comment
                </button>
              </div>
            </div>
          </div>
          <div className="form-actions">
            {onDelete && (
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                Delete
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function BoardSettingsModal({ onClose, board, onSave }) {
  const [projectData, setProjectData] = useState({
    name: board.name,
    projectId: board.projectId,
    description: board.description || '',
    projectLinks: board.projectLinks || [],
    projectComments: board.projectComments || []
  });
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');

  const addProjectLink = () => {
    if (linkLabel.trim() && linkUrl.trim()) {
      const newLink = {
        id: Date.now().toString(),
        label: linkLabel.trim(),
        url: linkUrl.trim()
      };
      setProjectData({ 
        ...projectData, 
        projectLinks: [...projectData.projectLinks, newLink] 
      });
      setLinkLabel('');
      setLinkUrl('');
    }
  };

  const removeProjectLink = (linkId) => {
    setProjectData({ 
      ...projectData, 
      projectLinks: projectData.projectLinks.filter(l => l.id !== linkId) 
    });
  };

  const addProjectComment = () => {
    if (commentText.trim() && commentAuthor.trim()) {
      const newComment = {
        id: Date.now().toString(),
        text: commentText.trim(),
        author: commentAuthor.trim(),
        timestamp: new Date().toISOString()
      };
      setProjectData({ 
        ...projectData, 
        projectComments: [...projectData.projectComments, newComment] 
      });
      setCommentText('');
    }
  };

  const removeProjectComment = (commentId) => {
    setProjectData({ 
      ...projectData, 
      projectComments: projectData.projectComments.filter(c => c.id !== commentId) 
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(projectData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Board Settings</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Board Name</label>
            <input
              type="text"
              className="form-input"
              value={projectData.name}
              onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
              placeholder="Enter board name"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Default Project ID Prefix</label>
            <input
              type="text"
              className="form-input"
              value={projectData.projectId}
              onChange={(e) => setProjectData({ ...projectData, projectId: e.target.value.toUpperCase() })}
              placeholder="e.g., PROJ, TEST"
              maxLength="10"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Board Description</label>
            <textarea
              className="form-textarea"
              value={projectData.description}
              onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
              placeholder="Describe the board purpose and overview..."
              rows="4"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Board Links</label>
            {projectData.projectLinks.map(link => (
              <div key={link.id} className="link-item">
                <div className="link-header">
                  <div style={{ flex: 1 }}>
                    <div className="link-label">{link.label}</div>
                    <a href={link.url} className="link-url" target="_blank" rel="noopener noreferrer">
                      {link.url}
                    </a>
                  </div>
                  <button 
                    type="button"
                    className="icon-btn" 
                    onClick={() => removeProjectLink(link.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                className="form-input"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Link label"
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="url"
                  className="form-input"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />
                <button type="button" className="btn btn-secondary" onClick={addProjectLink}>
                  Add Link
                </button>
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Board Comments &amp; Notes</label>
            {projectData.projectComments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-header">
                  <div>
                    <div className="comment-author">{comment.author}</div>
                    <div className="comment-time">
                      {new Date(comment.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <button 
                    type="button"
                    className="icon-btn" 
                    onClick={() => removeProjectComment(comment.id)}
                  >
                    🗑️
                  </button>
                </div>
                <div className="comment-text">{comment.text}</div>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                className="form-input"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                placeholder="Your name"
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <textarea
                  className="form-textarea"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a note or comment..."
                  rows="2"
                  style={{ flex: 1 }}
                />
              </div>
              <button type="button" className="btn btn-secondary" onClick={addProjectComment}>
                Add Comment
              </button>
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Board Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);