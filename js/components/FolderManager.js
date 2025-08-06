/**
 * Folder Manager Component
 * Handles folder operations and the auto-close behavior
 */

import logger from '../utils/logger.js';
import {
    FOLDER_ICONS,
    CSS_CLASSES,
    ELEMENT_IDS,
    DRAG_HANDLE
} from '../constants.js';
import {
    getElementById,
    querySelector,
    querySelectorAll,
    createElement,
    addClass,
    removeClass,
    hasClass,
    clearElement,
    setHTMLContent
} from '../utils/dom-utils.js';
import errorHandler from '../utils/error-handler.js';

const log = logger.createScope('FolderManager');

class FolderManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentFolder = null;
        this.init();
    }

    /**
     * Initialize folder manager
     */
    init() {
        try {
            this.setupEventListeners();
            this.render();
            log.info('Folder manager initialized successfully');
        } catch (error) {
            log.error('Failed to initialize folder manager', error);
            errorHandler.handleError({
                type: 'ui',
                message: 'Folder manager initialization failed',
                error,
                recoverable: true
            });
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Event delegation for folder clicks
        const folderList = getElementById(ELEMENT_IDS.FOLDER_LIST);
        if (folderList) {
            folderList.addEventListener('click', (e) => {
                const folderHeader = e.target.closest('.folder-header');
                if (folderHeader) {
                    const folderId = folderHeader.closest('.folder').dataset.folderId;
                    if (folderId) {
                        this.toggleFolder(folderId);
                    }
                }
            });
        }
    }

    /**
     * Check if a folder has subfolders
     * @param {string} folderId - Folder ID to check
     * @returns {boolean} True if folder has subfolders
     */
    hasSubfolders(folderId) {
        const bookmarkData = this.dataManager.getData();
        return bookmarkData.folders.some(folder => folder.parentId === folderId);
    }

    /**
     * Auto-close empty folders (folders without subfolders)
     * @param {string} currentFolderId - ID of currently clicked folder
     */
    autoCloseEmptyFolders(currentFolderId) {
        try {
            const expandedFolders = querySelectorAll(`.${CSS_CLASSES.FOLDER}.${CSS_CLASSES.EXPANDED}`);

            expandedFolders.forEach(folderElement => {
                const folderId = folderElement.getAttribute('data-folder-id');

                // Skip the current folder being clicked
                if (folderId === currentFolderId) {
                    return;
                }

                // Check if this folder has subfolders
                if (!this.hasSubfolders(folderId)) {
                    // Close the folder by removing expanded class and updating icon
                    removeClass(folderElement, CSS_CLASSES.EXPANDED);

                    const folderIcon = getElementById(`folder-icon-${folderId}`);
                    if (folderIcon) {
                        folderIcon.textContent = FOLDER_ICONS.CLOSED;
                        removeClass(folderIcon, 'open');
                    }

                    log.debug('Auto-closed empty folder', {
                        folderId
                    });
                }
            });
        } catch (error) {
            log.error('Error in auto-close empty folders', error);
        }
    }

    /**
     * Toggle folder expanded/collapsed state
     * @param {string} folderId - Folder ID to toggle
     */
    toggleFolder(folderId) {
        try {
            const folder = querySelector(`[data-folder-id="${folderId}"]`);
            const folderIcon = getElementById(`folder-icon-${folderId}`);

            if (!folder) {
                log.warn('Folder element not found', {
                    folderId
                });
                return;
            }

            // Auto-close empty folders before processing current folder
            this.autoCloseEmptyFolders(folderId);

            // Remove 'selected' class from all folders
            querySelectorAll(`.${CSS_CLASSES.FOLDER}`).forEach(f => {
                removeClass(f, CSS_CLASSES.SELECTED);
            });

            // Add 'selected' class to the clicked folder
            addClass(folder, CSS_CLASSES.SELECTED);

            // Toggle folder state
            if (hasClass(folder, CSS_CLASSES.EXPANDED)) {
                // Close folder
                removeClass(folder, CSS_CLASSES.EXPANDED);
                if (folderIcon) {
                    folderIcon.textContent = FOLDER_ICONS.CLOSED;
                    removeClass(folderIcon, 'open');
                }
                log.debug('Folder closed', {
                    folderId
                });
            } else {
                // Open folder
                addClass(folder, CSS_CLASSES.EXPANDED);
                if (folderIcon) {
                    folderIcon.textContent = FOLDER_ICONS.OPEN;
                    addClass(folderIcon, 'open');
                }

                // Render subfolders if folder has them
                this.renderSubfolders(folderId);
                log.debug('Folder opened', {
                    folderId
                });
            }

            this.currentFolder = folderId;

            // Debug logging
            console.log('Folder selected:', folderId, 'Current folder set to:', this.currentFolder);

            // Notify other components that folder selection changed
            this.notifyFolderChange(folderId);

        } catch (error) {
            log.error('Error toggling folder', {
                folderId,
                error
            });
            errorHandler.handleError({
                type: 'ui',
                message: `Failed to toggle folder ${folderId}`,
                error,
                recoverable: true
            });
        }
    }

    /**
     * Render subfolders for a parent folder
     * @param {string} parentId - Parent folder ID
     */
    renderSubfolders(parentId) {
        const subfolderContainer = getElementById(`subfolder-${parentId}`);
        if (!subfolderContainer) {
            log.debug('Subfolder container not found', {
                parentId
            });
            return;
        }

        clearElement(subfolderContainer);

        const bookmarkData = this.dataManager.getData();
        const subfolders = bookmarkData.folders
            .filter(f => f.parentId === parentId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        subfolders.forEach(subfolder => {
            const folderElement = this.createFolderElement(subfolder);
            subfolderContainer.appendChild(folderElement);
        });

        // Setup sortable for subfolders if Sortable is available
        if (window.Sortable) {
            new window.Sortable(subfolderContainer, {
                animation: 150,
                handle: `.${CSS_CLASSES.DRAG_HANDLE}`,
                ghostClass: CSS_CLASSES.DRAG_GHOST,
                group: 'folders',
                onEnd: () => {
                    this.updateSubfolderOrder(parentId);
                    this.dataManager.saveData();
                }
            });
        }

        log.debug('Rendered subfolders', {
            parentId,
            count: subfolders.length
        });
    }

    /**
     * Create folder element
     * @param {Object} folder - Folder data
     * @returns {HTMLElement} Folder element
     */
    createFolderElement(folder) {
        const folderDiv = createElement('div', {
            className: CSS_CLASSES.FOLDER,
            dataset: {
                folderId: folder.id
            }
        });

        const linkCount = this.getLinkCount(folder.id);
        const hasSubfoldersFlag = this.hasSubfolders(folder.id);

        // Create folder header
        const folderHeader = createElement('div', {
            className: 'folder-header'
        });

        // Add click handler for folder toggle
        folderHeader.addEventListener('click', (e) => {
            // Prevent event bubbling from action buttons
            if (!e.target.closest('.folder-actions')) {
                this.toggleFolder(folder.id);
            }
        });

        // Create folder title container
        const folderTitle = createElement('div', {
            className: 'folder-title'
        });

        // Add drag handle
        const dragHandle = createElement('span', {
            className: CSS_CLASSES.DRAG_HANDLE
        });
        dragHandle.textContent = DRAG_HANDLE;
        folderTitle.appendChild(dragHandle);

        // Add folder icon
        const folderIcon = createElement('span', {
            className: 'folder-icon',
            id: `folder-icon-${folder.id}`
        });
        folderIcon.textContent = FOLDER_ICONS.CLOSED;
        folderTitle.appendChild(folderIcon);

        // Add folder name
        const folderName = document.createTextNode(folder.name);
        folderTitle.appendChild(folderName);

        // Add link count
        const folderCount = createElement('span', {
            className: 'folder-count'
        });
        folderCount.textContent = `(${linkCount})`;
        folderTitle.appendChild(folderCount);

        folderHeader.appendChild(folderTitle);

        // Create folder actions
        const folderActions = createElement('div', {
            className: 'folder-actions'
        });

        const editBtn = createElement('button', {
            className: 'action-btn',
            title: 'Edit'
        });
        editBtn.textContent = '✏️';
        editBtn.onclick = () => window.editFolder(folder.id);
        folderActions.appendChild(editBtn);

        const deleteBtn = createElement('button', {
            className: 'action-btn',
            title: 'Delete'
        });
        deleteBtn.textContent = '🗑️';
        deleteBtn.onclick = () => window.deleteFolder(folder.id);
        folderActions.appendChild(deleteBtn);

        folderHeader.appendChild(folderActions);
        folderDiv.appendChild(folderHeader);

        // Add subfolder container if folder has subfolders
        if (hasSubfoldersFlag) {
            const subfolderContainer = createElement('div', {
                className: 'folder-content',
                id: `subfolder-${folder.id}`
            });
            folderDiv.appendChild(subfolderContainer);
        }

        return folderDiv;
    }

    /**
     * Get link count for a folder
     * @param {string} folderId - Folder ID
     * @returns {number} Number of links in folder
     */
    getLinkCount(folderId) {
        const bookmarkData = this.dataManager.getData();
        return bookmarkData.links.filter(link => link.folderId === folderId).length;
    }

    /**
     * Update subfolder order after drag and drop
     * @param {string} parentId - Parent folder ID
     */
    updateSubfolderOrder(parentId) {
        const container = getElementById(`subfolder-${parentId}`);
        if (!container) return;

        const folderElements = container.querySelectorAll(`.${CSS_CLASSES.FOLDER}`);
        const bookmarkData = this.dataManager.getData();

        folderElements.forEach((el, index) => {
            const folderId = el.dataset.folderId;
            const folder = bookmarkData.folders.find(f => f.id === folderId);
            if (folder) {
                folder.order = index;
            }
        });

        log.debug('Updated subfolder order', {
            parentId,
            count: folderElements.length
        });
    }

    /**
     * Render all folders
     */
    render() {
        try {
            const folderList = getElementById(ELEMENT_IDS.FOLDER_LIST);
            if (!folderList) {
                log.error('Folder list element not found');
                return;
            }

            clearElement(folderList);

            const bookmarkData = this.dataManager.getData();
            const rootFolders = bookmarkData.folders
                .filter(folder => !folder.parentId)
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            rootFolders.forEach(folder => {
                const folderElement = this.createFolderElement(folder);
                folderList.appendChild(folderElement);
            });

            // Setup sortable for root folders
            if (window.Sortable) {
                new window.Sortable(folderList, {
                    animation: 150,
                    handle: `.${CSS_CLASSES.DRAG_HANDLE}`,
                    ghostClass: CSS_CLASSES.DRAG_GHOST,
                    group: 'folders',
                    onEnd: () => {
                        this.updateRootFolderOrder();
                        this.dataManager.saveData();
                    }
                });
            }

            log.info('Folders rendered successfully', {
                count: rootFolders.length
            });

        } catch (error) {
            log.error('Error rendering folders', error);
            errorHandler.handleError({
                type: 'ui',
                message: 'Failed to render folders',
                error,
                recoverable: true
            });
        }
    }

    /**
     * Update root folder order after drag and drop
     */
    updateRootFolderOrder() {
        const folderList = getElementById(ELEMENT_IDS.FOLDER_LIST);
        if (!folderList) return;

        const folderElements = folderList.querySelectorAll(`.${CSS_CLASSES.FOLDER}`);
        const bookmarkData = this.dataManager.getData();

        folderElements.forEach((el, index) => {
            const folderId = el.dataset.folderId;
            const folder = bookmarkData.folders.find(f => f.id === folderId);
            if (folder) {
                folder.order = index;
            }
        });

        log.debug('Updated root folder order', {
            count: folderElements.length
        });
    }

    /**
     * Notify other components of folder change
     * @param {string} folderId - Selected folder ID
     */
    notifyFolderChange(folderId) {
        // Dispatch custom event for other components to listen to
        const event = new CustomEvent('folderChanged', {
            detail: {
                folderId,
                hasSubfolders: this.hasSubfolders(folderId)
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Escape HTML characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get current folder ID
     * @returns {string|null} Current folder ID
     */
    getCurrentFolder() {
        return this.currentFolder;
    }

    /**
     * Set current folder
     * @param {string} folderId - Folder ID to set as current
     */
    setCurrentFolder(folderId) {
        this.currentFolder = folderId;
        this.notifyFolderChange(folderId);
    }
}

export default FolderManager;