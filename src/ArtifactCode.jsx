import React, { useState, useCallback } from 'react';
import { Plus, Info, Clock, User, Bell, ArrowLeft, ZoomIn } from 'lucide-react';
import plantLayout from './assets/PLANTLAYOUT.png';
import lineLayout from './assets/LINELAYOUT.jpg';

const FACTORY_FLOOR_PLAN = plantLayout;
const ASSEMBLY_LINE_A_CAD = lineLayout;
// Test if images are loading
console.log('Factory Floor Plan URL:', FACTORY_FLOOR_PLAN);
console.log('Assembly Line A CAD URL:', ASSEMBLY_LINE_A_CAD);

const PlantProjectManager = () => {
  const [projects, setProjects] = useState({});
  const [selectedCells, setSelectedCells] = useState([]);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [currentView, setCurrentView] = useState('overview');
  const [selectedArea, setSelectedArea] = useState(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [userRole, setUserRole] = useState('engineer'); // 'engineer' or 'admin'
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [pendingArea, setPendingArea] = useState(null);
  const [customAreas, setCustomAreas] = useState([]);
  const [showManageAreas, setShowManageAreas] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [areaForm, setAreaForm] = useState({
    name: '',
    clickable: true,
    view: '',
    backgroundImage: ''
  });
  
  const DETAIL_GRID_WIDTH = 40;
  const DETAIL_GRID_HEIGHT = 25;
  
  const PROJECT_TYPES = {
    'maintenance': { color: '#ef4444', label: 'Maintenance' },
    'installation': { color: '#3b82f6', label: 'Equipment Installation' },
    'safety': { color: '#f59e0b', label: 'Safety Inspection' },
    'upgrade': { color: '#10b981', label: 'System Upgrade' },
    'testing': { color: '#8b5cf6', label: 'Testing & QA' },
    'construction': { color: '#f97316', label: 'Construction' }
  };

  const [projectForm, setProjectForm] = useState({
    title: '',
    engineer: '',
    type: 'maintenance',
    duration: '1',
    description: '',
    priority: 'medium',
    area: ''
  });

  const PLANT_AREAS = {
    'Assembly Line A': { 
      x: 200, y: 150, width: 300, height: 100,
      clickable: true,
      view: 'assembly-a'
    },
    'Assembly Line B': { 
      x: 200, y: 280, width: 300, height: 100,
      clickable: false
    },
    'Quality Control': { 
      x: 520, y: 150, width: 120, height: 80,
      clickable: false
    }
  };

  // Combine default and custom areas
  const getAllAreas = () => {
    const allAreas = { ...PLANT_AREAS };
    
    // Get list of deleted built-in areas
    const deletedBuiltIns = customAreas
      .filter(area => area.isDeletedBuiltIn)
      .map(area => area.originalName);
    
    // Remove deleted built-in areas
    deletedBuiltIns.forEach(name => {
      delete allAreas[name];
    });
    
    customAreas.forEach(area => {
      if (area.isModifiedBuiltIn) {
        // Replace built-in area with modified version
        delete allAreas[area.originalName];
        allAreas[area.name] = area;
      } else if (!area.isDeletedBuiltIn) {
        // Add custom area (skip deleted built-in markers)
        allAreas[area.name] = area;
      }
    });
    
    return allAreas;
  };

  // Convert built-in areas to manageable format
  const getManageableAreas = () => {
    // Get list of deleted built-in areas
    const deletedBuiltIns = customAreas
      .filter(area => area.isDeletedBuiltIn)
      .map(area => area.originalName);
    
    // Only include built-in areas that haven't been deleted
    const builtInAreas = Object.entries(PLANT_AREAS)
      .filter(([name]) => !deletedBuiltIns.includes(name))
      .map(([name, area]) => ({
        ...area,
        name,
        id: `builtin-${name}`,
        isBuiltIn: true,
        backgroundImage: area.backgroundImage || ''
      }));
    
    // Only include custom areas that aren't deletion markers
    const activeCustomAreas = customAreas.filter(area => !area.isDeletedBuiltIn);
    
    return [...builtInAreas, ...activeCustomAreas];
  };

  const handleOverviewMouseDown = (e) => {
    if (!isCreatingArea || userRole !== 'admin') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDragStart({ x, y });
    setIsDragging(true);
  };

  const handleOverviewMouseMove = (e) => {
    if (!isDragging || !dragStart) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDragEnd({ x, y });
  };

  const handleOverviewMouseUp = (e) => {
    if (!isCreatingArea) return;
    
    // If we were dragging, try to create an area
    if (isDragging && dragStart) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const finalDragEnd = { x, y };
      
      // Calculate area dimensions
      const left = Math.min(dragStart.x, finalDragEnd.x);
      const top = Math.min(dragStart.y, finalDragEnd.y);
      const width = Math.abs(finalDragEnd.x - dragStart.x);
      const height = Math.abs(finalDragEnd.y - dragStart.y);
      
      // Only create area if it's big enough
      if (width > 50 && height > 30) {
        setPendingArea({
          x: left,
          y: top,
          width,
          height,
          clickable: true,
          view: ''
        });
        setShowAreaForm(true);
        // Don't exit creation mode yet - wait for form completion
        setDragStart(null);
        setDragEnd(null);
        setIsDragging(false);
        return;
      }
    }
    
    // Reset all drag state and exit creation mode if no valid area was created
    setDragStart(null);
    setDragEnd(null);
    setIsDragging(false);
    setIsCreatingArea(false);
  };

  const handleCreateArea = () => {
    if (!pendingArea || !areaForm.name) return;
    
    const newArea = {
      ...pendingArea,
      name: areaForm.name,
      clickable: areaForm.clickable,
      view: areaForm.clickable ? areaForm.view : '',
      backgroundImage: areaForm.backgroundImage || '',
      id: Date.now() // Add unique ID for management
    };
    
    setCustomAreas(prev => [...prev, newArea]);
    
    const notification = {
      id: Date.now(),
      message: `New area "${areaForm.name}" created by admin`,
      timestamp: new Date().toLocaleTimeString()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    setShowAreaForm(false);
    setPendingArea(null);
    setAreaForm({ name: '', clickable: true, view: '', backgroundImage: '' });
  };

  const handleDeleteArea = (areaId, isBuiltIn, areaName) => {
    if (isBuiltIn) {
      // For built-in areas, we'll hide them by adding a "deleted" flag
      const deletedBuiltIn = {
        id: `deleted-${areaName}`,
        originalName: areaName,
        isDeletedBuiltIn: true
      };
      
      setCustomAreas(prev => [
        ...prev.filter(area => !(area.isDeletedBuiltIn && area.originalName === areaName)),
        deletedBuiltIn
      ]);
      
      const notification = {
        id: Date.now(),
        message: `Built-in area "${areaName}" deleted by admin`,
        timestamp: new Date().toLocaleTimeString()
      };
      setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    } else {
      setCustomAreas(prev => prev.filter(area => area.id !== areaId));
      
      const notification = {
        id: Date.now(),
        message: `Area deleted by admin`,
        timestamp: new Date().toLocaleTimeString()
      };
      setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    }
  };

  const handleEditArea = (area) => {
    setEditingArea(area);
    setAreaForm({
      name: area.name,
      clickable: area.clickable,
      view: area.view || '',
      backgroundImage: area.backgroundImage || ''
    });
  };

  const handleSaveAreaEdit = () => {
    if (!editingArea || !areaForm.name) return;
    
    if (editingArea.isBuiltIn) {
      // For built-in areas, we'll store the modifications in customAreas with a special flag
      const modifiedBuiltIn = {
        ...editingArea,
        name: areaForm.name,
        clickable: areaForm.clickable,
        view: areaForm.clickable ? areaForm.view : '',
        backgroundImage: areaForm.backgroundImage || '',
        isModifiedBuiltIn: true,
        originalName: editingArea.name
      };
      
      // Remove any existing modification of this built-in area
      setCustomAreas(prev => [
        ...prev.filter(area => !(area.isModifiedBuiltIn && area.originalName === editingArea.name)),
        modifiedBuiltIn
      ]);
    } else {
      // For custom areas, update normally
      setCustomAreas(prev => prev.map(area => 
        area.id === editingArea.id 
          ? { 
              ...area, 
              name: areaForm.name, 
              clickable: areaForm.clickable, 
              view: areaForm.clickable ? areaForm.view : '',
              backgroundImage: areaForm.backgroundImage || ''
            }
          : area
      ));
    }
    
    const notification = {
      id: Date.now(),
      message: `Area "${areaForm.name}" updated by admin`,
      timestamp: new Date().toLocaleTimeString()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    setEditingArea(null);
    setAreaForm({ name: '', clickable: true, view: '', backgroundImage: '' });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAreaForm(prev => ({ ...prev, backgroundImage: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const renderDragPreview = () => {
    if (!isDragging || !dragStart || !dragEnd) return null;
    
    const left = Math.min(dragStart.x, dragEnd.x);
    const top = Math.min(dragStart.y, dragEnd.y);
    const width = Math.abs(dragEnd.x - dragStart.x);
    const height = Math.abs(dragEnd.y - dragStart.y);
    
    return (
      <div
        style={{
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: 'rgba(16, 185, 129, 0.3)',
          border: '2px dashed #10b981',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 10
        }}
      />
    );
  };

  const getCellKey = (x, y, area = currentView) => `${area}-${x}-${y}`;
  
  const handleOverviewAreaClick = (areaName, areaConfig) => {
    if (areaConfig.clickable && areaConfig.view) {
      setCurrentView(areaConfig.view);
      setSelectedArea(areaName);
    }
  };

  const handleDetailCellClick = useCallback((x, y) => {
    const cellKey = getCellKey(x, y);
    
    if (isCreatingProject) {
      setSelectedCells(prev => {
        const isSelected = prev.some(cell => cell.x === x && cell.y === y);
        if (isSelected) {
          return prev.filter(cell => !(cell.x === x && cell.y === y));
        } else {
          return [...prev, { x, y }];
        }
      });
      return;
    }
    
    if (projects[cellKey] && projects[cellKey].length > 0) {
      if (projects[cellKey].length === 1) {
        setSelectedProject({ ...projects[cellKey][0], cellProjects: projects[cellKey] });
      } else {
        setSelectedProject({ ...projects[cellKey][0], cellProjects: projects[cellKey] });
      }
      return;
    }
  }, [projects, currentView, isCreatingProject]);

  const handleCreateProject = () => {
    if (selectedCells.length === 0) {
      alert('Please select at least one grid cell for your project area.');
      return;
    }

    const newProject = {
      ...projectForm,
      id: Date.now(),
      cells: selectedCells,
      area: selectedArea || projectForm.area,
      view: currentView,
      startDate: new Date().toLocaleDateString(),
      endDate: new Date(Date.now() + parseInt(projectForm.duration) * 24 * 60 * 60 * 1000).toLocaleDateString(),
      status: 'active'
    };

    const newProjects = { ...projects };
    selectedCells.forEach(cell => {
      const cellKey = getCellKey(cell.x, cell.y);
      if (!newProjects[cellKey]) {
        newProjects[cellKey] = [];
      }
      newProjects[cellKey].push(newProject);
    });
    
    setProjects(newProjects);
    
    const notification = {
      id: Date.now(),
      message: `New ${PROJECT_TYPES[projectForm.type].label.toLowerCase()} project "${projectForm.title}" started by ${projectForm.engineer} in ${selectedArea || projectForm.area}`,
      timestamp: new Date().toLocaleTimeString()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    setSelectedCells([]);
    setProjectForm({
      title: '',
      engineer: '',
      type: 'maintenance',
      duration: '1',
      description: '',
      priority: 'medium',
      area: selectedArea || ''
    });
    setShowProjectForm(false);
    setIsCreatingProject(false);
  };

  const mixColors = (projectTypes) => {
    if (projectTypes.length === 1) {
      return PROJECT_TYPES[projectTypes[0]].color;
    }
    
    const colorMixes = {
      'maintenance,installation': '#8b5cf6',
      'maintenance,safety': '#f97316',
      'installation,safety': '#06b6d4',
      'maintenance,upgrade': '#84cc16',
      'installation,upgrade': '#10b981',
      'safety,upgrade': '#f59e0b',
      'maintenance,testing': '#ec4899',
      'installation,testing': '#6366f1',
      'safety,testing': '#8b5cf6',
      'upgrade,testing': '#06b6d4',
      'maintenance,construction': '#dc2626',
      'installation,construction': '#7c3aed',
      'safety,construction': '#ea580c',
      'upgrade,construction': '#059669',
      'testing,construction': '#7c2d12',
    };
    
    const sortedTypes = [...new Set(projectTypes)].sort().join(',');
    return colorMixes[sortedTypes] || '#6b7280';
  };

  const getFilteredProjects = (cellProjects) => {
    if (!cellProjects) return [];
    
    return cellProjects.filter(project => {
      if (dateFilter !== 'all') {
        const projectDate = new Date(project.startDate);
        const today = new Date();
        const diffTime = projectDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (dateFilter === 'today' && diffDays !== 0) return false;
        if (dateFilter === 'week' && (diffDays < 0 || diffDays > 7)) return false;
        if (dateFilter === 'month' && (diffDays < 0 || diffDays > 30)) return false;
      }
      
      if (typeFilter !== 'all' && project.type !== typeFilter) return false;
      
      return true;
    });
  };

  const getCellColor = (x, y) => {
    const cellKey = getCellKey(x, y);
    const cellProjects = projects[cellKey];
    const filteredProjects = getFilteredProjects(cellProjects);
    
    // If cell is selected (in creation mode), always show selection color with high opacity
    if (selectedCells.some(cell => cell.x === x && cell.y === y)) {
      return '#94a3b8'; // Grey selection color
    }
    
    if (filteredProjects && filteredProjects.length > 0) {
      const projectTypes = filteredProjects.map(p => p.type);
      return mixColors(projectTypes);
    }
    
    return 'transparent';
  };

  const getCellBorder = (x, y) => {
    const cellKey = getCellKey(x, y);
    const cellProjects = projects[cellKey];
    const filteredProjects = getFilteredProjects(cellProjects);
    
    // If cell is selected, give it a distinct border
    if (selectedCells.some(cell => cell.x === x && cell.y === y)) {
      return '3px solid #475569'; // Thick grey border for selected cells
    }
    
    if (filteredProjects && filteredProjects.length > 0) {
      if (filteredProjects.length > 1) {
        return '3px solid #1f2937';
      } else {
        return '2px solid #1f2937';
      }
    }
    
    return isCreatingProject ? '1px solid #3b82f6' : '1px solid rgba(229, 231, 235, 0.3)';
  };

  const getCellOpacity = (x, y) => {
    const cellKey = getCellKey(x, y);
    const cellProjects = projects[cellKey];
    const filteredProjects = getFilteredProjects(cellProjects);
    
    // Selected cells should be semi-transparent to show background
    if (selectedCells.some(cell => cell.x === x && cell.y === y)) {
      return 0.7;
    }
    
    if (filteredProjects && filteredProjects.length > 0) {
      return 0.5; // More transparent to show background image
    }
    
    return isCreatingProject ? 0.3 : 0.2;
  };

  const getCellContent = (x, y) => {
    const cellKey = getCellKey(x, y);
    const cellProjects = projects[cellKey];
    const filteredProjects = getFilteredProjects(cellProjects);
    
    if (filteredProjects && filteredProjects.length > 1) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-xs font-bold bg-black bg-opacity-50 rounded px-1">
            {filteredProjects.length}
          </span>
        </div>
      );
    }
    return null;
  };

  const renderOverviewLayout = () => {
    const allAreas = getAllAreas();
    
    return (
      <div className="relative bg-gray-100 rounded-lg overflow-auto">
        <div 
          style={{
            width: '800px',
            height: '500px',
            backgroundImage: `url("${FACTORY_FLOOR_PLAN}")`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundColor: '#e5e7eb',
            minWidth: '800px',
            minHeight: '500px',
            position: 'relative',
            cursor: isCreatingArea ? 'crosshair' : 'default'
          }}
          onMouseDown={handleOverviewMouseDown}
          onMouseMove={handleOverviewMouseMove}
          onMouseUp={handleOverviewMouseUp}
        >
          {/* Placeholder text - only visible when using default placeholder image */}
          {FACTORY_FLOOR_PLAN.includes('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==') && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white bg-opacity-90 p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Factory Floor Plan</h3>
                <p className="text-gray-600 mb-4">Your uploaded image would appear here as the background</p>
                <p className="text-sm text-gray-500">
                  {userRole === 'admin' ? 'Click Assembly Line A to zoom, or use "Add New Area" to create areas' : 'Click on Assembly Line A area below to test zoom functionality'}
                </p>
              </div>
            </div>
          )}

          {/* Render all areas (default + custom) */}
          {Object.entries(allAreas).map(([name, area]) => (
            <div
              key={name}
              style={{
                position: 'absolute',
                left: `${area.x}px`,
                top: `${area.y}px`,
                width: `${area.width}px`,
                height: `${area.height}px`,
                cursor: area.clickable ? 'pointer' : 'default',
                backgroundColor: area.clickable ? 'rgba(59, 130, 246, 0.4)' : 'rgba(107, 114, 128, 0.3)',
                border: area.clickable ? '2px dashed #3b82f6' : '2px solid #6b7280',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              className={area.clickable ? 'hover:bg-blue-300 hover:bg-opacity-30' : ''}
              onClick={() => area.clickable && handleOverviewAreaClick(name, area)}
            >
              <div className={`text-center px-2 py-1 rounded ${area.clickable ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'} text-sm font-medium`}>
                {name}
                {area.clickable && (
                  <div className="flex items-center gap-1 mt-1">
                    <ZoomIn size={14} />
                    <span className="text-xs">Click to zoom</span>
                  </div>
                )}

        {/* Manage Areas Modal */}
        {showManageAreas && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">Manage Areas</h3>
                <p className="text-sm text-gray-600 mt-1">Edit, delete, or upload images for factory areas</p>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">All Areas</h4>
                  {getManageableAreas().length === 0 ? (
                    <p className="text-gray-500 text-sm py-8 text-center">No areas found.</p>
                  ) : (
                    <div className="space-y-3">
                      {getManageableAreas().map((area) => (
                        <div key={area.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: area.clickable ? '#3b82f6' : '#6b7280' }} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h5 className="font-medium text-gray-900">{area.name}</h5>
                                {area.isBuiltIn && (
                                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Built-in</span>
                                )}
                                {area.isModifiedBuiltIn && (
                                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Modified</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                {area.width} × {area.height}px | {area.clickable ? 'Clickable' : 'Display only'}
                                {area.view && ` | View: ${area.view}`}
                              </p>
                              {area.backgroundImage && (
                                <div className="mt-2">
                                  <img 
                                    src={area.backgroundImage} 
                                    alt={area.name} 
                                    className="w-20 h-12 object-cover rounded border"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                handleEditArea(area);
                                setShowManageAreas(false);
                                setShowAreaForm(true);
                              }}
                              className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete area "${area.name}"? This action cannot be undone.`)) {
                                  handleDeleteArea(area.id, area.isBuiltIn, area.name);
                                }
                              }}
                              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t">
                <button
                  onClick={() => {
                    setShowManageAreas(false);
                    // Reset any editing state that might interfere with area creation
                    setEditingArea(null);
                    setAreaForm({ name: '', clickable: true, view: '', backgroundImage: '' });
                    setPendingArea(null);
                    setShowAreaForm(false);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Area Creation Form Modal */}
        {showAreaForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Create New Area</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Area Name</label>
                    <input
                      type="text"
                      value={areaForm.name}
                      onChange={(e) => setAreaForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                      placeholder="e.g., Assembly Line C, Weld Station"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="clickable"
                      checked={areaForm.clickable}
                      onChange={(e) => setAreaForm(prev => ({ ...prev, clickable: e.target.checked }))}
                      className="mr-2"
                    />
                    <label htmlFor="clickable" className="text-sm text-gray-700">
                      Make area clickable (allows zoom/detailed view)
                    </label>
                  </div>
                  
                  {areaForm.clickable && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Detail View ID (optional)
                      </label>
                      <input
                        type="text"
                        value={areaForm.view}
                        onChange={(e) => setAreaForm(prev => ({ ...prev, view: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                        placeholder="e.g., assembly-c, weld-station"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Used for detailed CAD view. Leave empty for basic clickable area.
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Background Image (optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                    />
                    {areaForm.backgroundImage && (
                      <div className="mt-2">
                        <img 
                          src={areaForm.backgroundImage} 
                          alt="Preview" 
                          className="w-full h-20 object-cover rounded border"
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Upload a CAD drawing or image for this area's detailed view.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Position:</strong> x: {pendingArea?.x}, y: {pendingArea?.y}
                    </p>
                    <p className="text-sm text-green-800">
                      <strong>Size:</strong> {pendingArea?.width} × {pendingArea?.height} px
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAreaForm(false);
                      setPendingArea(null);
                      setEditingArea(null);
                      setIsCreatingArea(false);
                      setAreaForm({ name: '', clickable: true, view: '', backgroundImage: '' });
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingArea ? handleSaveAreaEdit : handleCreateArea}
                    disabled={!areaForm.name}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                  >
                    {editingArea ? 'Save Changes' : 'Create Area'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
              </div>
            </div>
          ))}
          
          {/* Drag preview for new area */}
          {renderDragPreview()}
        </div>
      </div>
    );
  };

  const renderDetailGrid = () => {
    if (currentView !== 'assembly-a') return null;

    const cells = [];
    const cellSize = 20;
    
    for (let y = 0; y < DETAIL_GRID_HEIGHT; y++) {
      for (let x = 0; x < DETAIL_GRID_WIDTH; x++) {
        cells.push(
          <div
            key={getCellKey(x, y)}
            className="cell"
            style={{
              position: 'absolute',
              left: `${x * cellSize}px`,
              top: `${y * cellSize}px`,
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              backgroundColor: getCellColor(x, y),
              border: getCellBorder(x, y),
              cursor: 'pointer',
              opacity: getCellOpacity(x, y),
              borderRadius: '2px'
            }}
            onClick={() => handleDetailCellClick(x, y)}
          >
            {getCellContent(x, y)}
          </div>
        );
      }
    }
    
    return (
      <div className="relative bg-gray-100 rounded-lg p-4 overflow-auto">
        <div 
          style={{
            position: 'relative',
            width: `${DETAIL_GRID_WIDTH * cellSize}px`,
            height: `${DETAIL_GRID_HEIGHT * cellSize}px`,
            minWidth: `${DETAIL_GRID_WIDTH * cellSize}px`,
            minHeight: `${DETAIL_GRID_HEIGHT * cellSize}px`,
            backgroundImage: `url("${ASSEMBLY_LINE_A_CAD}")`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundColor: '#f3f4f6'
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white bg-opacity-90 p-4 rounded-lg shadow text-center">
              <h4 className="font-semibold text-gray-800">Assembly Line A - Detailed View</h4>
              <p className="text-sm text-gray-600 mt-1">Your detailed CAD image would appear here</p>
              <p className="text-xs text-gray-500 mt-2">Click grid cells to select project areas</p>
            </div>
          </div>
          
          {cells}
        </div>
      </div>
    );
  };

  const backToOverview = () => {
    setCurrentView('overview');
    setSelectedArea(null);
    setSelectedCells([]);
    setIsCreatingProject(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {currentView !== 'overview' && (
                <button
                  onClick={backToOverview}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft size={20} />
                  <span>Back to Overview</span>
                </button>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Plant Project Manager</h1>
                <p className="text-gray-600 mt-1">
                  {currentView === 'overview' 
                    ? 'Manufacturing Floor Overview - Click areas to zoom in'
                    : `${selectedArea} - Detailed View`
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {/* Role Toggle Button */}
              <button
                onClick={() => setUserRole(userRole === 'admin' ? 'engineer' : 'admin')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  userRole === 'admin' 
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {userRole === 'admin' ? 'Admin View' : 'Switch to Admin'}
              </button>
              
              {currentView === 'overview' && userRole === 'admin' && (
                <>
                  <button
                    onClick={() => setIsCreatingArea(true)}
                    disabled={isCreatingArea}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400"
                  >
                    <Plus size={20} />
                    {isCreatingArea ? 'Click & Drag to Create' : 'Add New Area'}
                  </button>
                  
                  <button
                    onClick={() => setShowManageAreas(true)}
                    className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <User size={20} />
                    Manage Areas
                  </button>
                </>
              )}
              
              {currentView !== 'overview' && (
                <>
                  <button
                    onClick={() => {
                      setIsCreatingProject(true);
                      setShowProjectForm(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={20} />
                    New Project
                  </button>
                  
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                  
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="all">All Types</option>
                    {Object.entries(PROJECT_TYPES).map(([key, type]) => (
                      <option key={key} value={key}>{type.label}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">Project Types</h3>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(PROJECT_TYPES).map(([key, type]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="text-sm text-gray-600">{type.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">Mixed Project Colors</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#8b5cf6' }} />
                    <span className="text-gray-600">Maintenance + Installation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }} />
                    <span className="text-gray-600">Maintenance + Safety</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#06b6d4' }} />
                    <span className="text-gray-600">Installation + Safety</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#84cc16' }} />
                    <span className="text-gray-600">Maintenance + Upgrade</span>
                  </div>
                </div>
              </div>
            </div>
            
            {isCreatingProject && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm font-medium">
                  Project Creation Mode: Click grid cells to select areas for your new project
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {currentView === 'overview' ? 'Plant Floor Layout' : `${selectedArea} - Detailed Layout`}
            </h2>
            
            {currentView === 'overview' ? renderOverviewLayout() : renderDetailGrid()}
            
            {selectedCells.length > 0 && isCreatingProject && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  {selectedCells.length} grid cell{selectedCells.length > 1 ? 's' : ''} selected in {selectedArea}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell size={20} className="text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Recent Updates</h3>
              </div>
              {notifications.length === 0 ? (
                <p className="text-gray-500 text-sm">No recent notifications</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map(notification => (
                    <div key={notification.id} className="p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                      <p className="text-sm text-gray-800">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{notification.timestamp}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Projects</h3>
              {Object.keys(projects).length === 0 ? (
                <p className="text-gray-500 text-sm">No active projects</p>
              ) : (
                <div className="space-y-3">
                  {Object.values(projects).reduce((unique, cellProjects) => {
                    if (Array.isArray(cellProjects)) {
                      cellProjects.forEach(project => {
                        if (!unique.find(p => p.id === project.id)) {
                          unique.push(project);
                        }
                      });
                    }
                    return unique;
                  }, []).map(project => (
                    <div key={project.id} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: PROJECT_TYPES[project.type].color }}
                        />
                        <h4 className="font-medium text-sm">{project.title}</h4>
                      </div>
                      <p className="text-xs text-gray-600">Engineer: {project.engineer}</p>
                      <p className="text-xs text-gray-600">Area: {project.area}</p>
                      <p className="text-xs text-gray-600">Duration: {project.duration} day{parseInt(project.duration) > 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {showProjectForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden">
              <div className="flex flex-col h-full">
                <div className="p-6 border-b">
                  <h3 className="text-xl font-semibold text-gray-900">Create New Project in {selectedArea}</h3>
                  <p className="text-sm text-gray-600 mt-1">Fill out the project details and select grid cells on the map</p>
                </div>
                
                <div className="flex-1 flex overflow-hidden">
                  <div className="w-80 p-6 border-r overflow-y-auto">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                        <input
                          type="text"
                          value={projectForm.title}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Enter project title"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Engineer Name</label>
                        <input
                          type="text"
                          value={projectForm.engineer}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, engineer: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Your name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                        <select
                          value={projectForm.type}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, type: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          {Object.entries(PROJECT_TYPES).map(([key, type]) => (
                            <option key={key} value={key}>{type.label}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                        <input
                          type="number"
                          min="1"
                          value={projectForm.duration}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, duration: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                        <select
                          value={projectForm.priority}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, priority: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={projectForm.description}
                          onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          rows={3}
                          placeholder="Brief description of the project"
                        />
                      </div>
                      
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800 font-medium mb-1">
                          Selected Area: {selectedArea}
                        </p>
                        <p className="text-sm text-blue-600">
                          Grid cells selected: {selectedCells.length}
                        </p>
                        {selectedCells.length > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            Click grid cells on the right to add/remove them
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-6 pt-4 border-t">
                      <button
                        onClick={() => {
                          setShowProjectForm(false);
                          setIsCreatingProject(false);
                          setSelectedCells([]);
                        }}
                        className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateProject}
                        disabled={selectedCells.length === 0}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                      >
                        Create Project
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-6 overflow-auto">
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">{selectedArea} - Select Project Area</h4>
                      <p className="text-sm text-gray-600">Click grid cells to select areas for your project</p>
                    </div>
                    
                    {currentView === 'assembly-a' && (
                      <div className="relative bg-gray-100 rounded-lg p-4">
                        <div 
                          style={{
                            position: 'relative',
                            width: `${DETAIL_GRID_WIDTH * 20}px`,
                            height: `${DETAIL_GRID_HEIGHT * 20}px`,
                            minWidth: `${DETAIL_GRID_WIDTH * 20}px`,
                            minHeight: `${DETAIL_GRID_HEIGHT * 20}px`,
                            backgroundImage: `url("${ASSEMBLY_LINE_A_CAD}")`,
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundColor: '#f3f4f6'
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-white bg-opacity-90 p-4 rounded-lg shadow text-center">
                              <h5 className="font-semibold text-gray-800">Assembly Line A - Detailed View</h5>
                              <p className="text-sm text-gray-600 mt-1">Your detailed CAD image would appear here</p>
                            </div>
                          </div>
                          
                          {(() => {
                            const cells = [];
                            const cellSize = 20;
                            
                            for (let y = 0; y < DETAIL_GRID_HEIGHT; y++) {
                              for (let x = 0; x < DETAIL_GRID_WIDTH; x++) {
                                cells.push(
                                  <div
                                    key={`modal-${getCellKey(x, y)}`}
                                    className="cell"
                                    style={{
                                      position: 'absolute',
                                      left: `${x * cellSize}px`,
                                      top: `${y * cellSize}px`,
                                      width: `${cellSize}px`,
                                      height: `${cellSize}px`,
                                      backgroundColor: getCellColor(x, y),
                                      border: getCellBorder(x, y),
                                      cursor: 'pointer',
                                      opacity: getCellOpacity(x, y),
                                      borderRadius: '2px'
                                    }}
                                    onClick={() => handleDetailCellClick(x, y)}
                                  >
                                    {getCellContent(x, y)}
                                  </div>
                                );
                              }
                            }
                            
                            return cells;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {selectedProject.cellProjects && selectedProject.cellProjects.length > 1 ? (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      Multiple Projects in This Area ({selectedProject.cellProjects.length})
                    </h3>
                    
                    <div className="space-y-4 max-h-60 overflow-y-auto">
                      {selectedProject.cellProjects.map((project) => (
                        <div key={project.id} className="border rounded-lg p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <div 
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: PROJECT_TYPES[project.type].color }}
                            />
                            <h4 className="font-semibold text-gray-900">{project.title}</h4>
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <User size={14} />
                              <span>Engineer: {project.engineer}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Info size={14} />
                              <span>Type: {PROJECT_TYPES[project.type].label}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Clock size={14} />
                              <span>Duration: {project.duration} day{parseInt(project.duration) > 1 ? 's' : ''}</span>
                            </div>
                            
                            <div>
                              <span className="font-medium">Period:</span> {project.startDate} - {project.endDate}
                            </div>
                            
                            <div>
                              <span className="font-medium">Priority:</span> 
                              <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                                project.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                project.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                project.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {project.priority}
                              </span>
                            </div>
                            
                            {project.description && (
                              <div>
                                <span className="font-medium">Description:</span>
                                <p className="mt-1 text-xs">{project.description}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: PROJECT_TYPES[selectedProject.type].color }}
                      />
                      <h3 className="text-xl font-semibold text-gray-900">{selectedProject.title}</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User size={16} />
                        <span>Engineer: {selectedProject.engineer}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-gray-600">
                        <Info size={16} />
                        <span>Type: {PROJECT_TYPES[selectedProject.type].label}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock size={16} />
                        <span>Duration: {selectedProject.duration} day{parseInt(selectedProject.duration) > 1 ? 's' : ''}</span>
                      </div>
                      
                      <div className="text-gray-600">
                        <span className="font-medium">Period:</span> {selectedProject.startDate} - {selectedProject.endDate}
                      </div>
                      
                      <div className="text-gray-600">
                        <span className="font-medium">Area:</span> {selectedProject.area}
                      </div>
                      
                      <div className="text-gray-600">
                        <span className="font-medium">Priority:</span> 
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                          selectedProject.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          selectedProject.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          selectedProject.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {selectedProject.priority}
                        </span>
                      </div>
                      
                      {selectedProject.description && (
                        <div className="text-gray-600">
                          <span className="font-medium">Description:</span>
                          <p className="mt-1 text-sm">{selectedProject.description}</p>
                        </div>
                      )}
                      
                      <div className="text-gray-600">
                        <span className="font-medium">Area Coverage:</span> {selectedProject.cells.length} grid cell{selectedProject.cells.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => setSelectedProject(null)}
                  className="w-full mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlantProjectManager;