/**
 * Data Manager
 * Handles data persistence and API communication
 */

import logger from '../utils/logger.js';
import {
    API_ENDPOINTS,
    ERROR_MESSAGES,
    NOTES_DEFAULTS
} from '../constants.js';
import errorHandler from '../utils/error-handler.js';

const log = logger.createScope('DataManager');

class DataManager {
    constructor() {
        this.data = {
            folders: [],
            links: [],
            notes: {
                content: NOTES_DEFAULTS.CONTENT,
                plainContent: NOTES_DEFAULTS.PLAIN_CONTENT,
                position: {
                    ...NOTES_DEFAULTS.POSITION
                },
                size: {
                    ...NOTES_DEFAULTS.SIZE
                },
                formatVersion: NOTES_DEFAULTS.FORMAT_VERSION
            }
        };
        this.saveInProgress = false;
        this.pendingSave = false;
    }

    /**
     * Load data from server
     * @returns {Promise<Object>} Loaded data
     */
    async loadData() {
        try {
            log.info('Loading bookmark data from server');

            const response = await fetch(`bookmark_api.php${API_ENDPOINTS.LOAD}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || ERROR_MESSAGES.LOAD_FAILED);
            }

            // Validate and sanitize loaded data
            this.data = this.validateAndSanitizeData(result.data);

            log.info('Data loaded successfully', {
                folders: this.data.folders.length,
                links: this.data.links.length,
                hasNotes: !!this.data.notes
            });

            return this.data;

        } catch (error) {
            log.error('Failed to load data', error);

            errorHandler.handleError({
                type: 'network',
                message: ERROR_MESSAGES.LOAD_FAILED,
                error,
                recoverable: true,
                request: {
                    method: 'GET',
                    url: 'bookmark_api.php?action=load'
                }
            });

            // Return default data structure on failure
            return this.getDefaultData();
        }
    }

    /**
     * Save data to server
     * @returns {Promise<boolean>} Success status
     */
    async saveData() {
        // Prevent concurrent saves
        if (this.saveInProgress) {
            this.pendingSave = true;
            return false;
        }

        try {
            this.saveInProgress = true;
            log.debug('Saving bookmark data to server');

            const response = await fetch(API_ENDPOINTS.SAVE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'save',
                    data: this.data
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || ERROR_MESSAGES.SAVE_FAILED);
            }

            log.debug('Data saved successfully');

            // Handle pending save if one was queued
            if (this.pendingSave) {
                this.pendingSave = false;
                // Schedule another save after a short delay
                setTimeout(() => this.saveData(), 100);
            }

            return true;

        } catch (error) {
            log.error('Failed to save data', error);

            errorHandler.handleError({
                type: 'network',
                message: ERROR_MESSAGES.SAVE_FAILED,
                error,
                recoverable: true,
                request: {
                    method: 'POST',
                    url: 'bookmark_api.php',
                    data: this.data
                }
            });

            return false;
        } finally {
            this.saveInProgress = false;
        }
    }

    /**
     * Save data with retry mechanism
     * @param {number} maxRetries - Maximum number of retry attempts
     * @returns {Promise<boolean>} Success status
     */
    async saveDataWithRetry(maxRetries = 3) {
        let attempts = 0;

        while (attempts < maxRetries) {
            try {
                const success = await this.saveData();
                if (success) {
                    if (attempts > 0) {
                        log.info(`Save successful on attempt ${attempts + 1}`);
                    }
                    return true;
                }
            } catch (error) {
                log.warn(`Save attempt ${attempts + 1} failed`, error);
            }

            attempts++;

            if (attempts < maxRetries) {
                // Exponential backoff
                const delay = Math.pow(2, attempts) * 100;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        log.error(`All ${maxRetries} save attempts failed`);
        return false;
    }

    /**
     * Validate and sanitize loaded data
     * @param {Object} data - Raw data from server
     * @returns {Object} Validated and sanitized data
     */
    validateAndSanitizeData(data) {
        const sanitized = {
            folders: [],
            links: [],
            notes: this.getDefaultNotes()
        };

        // Validate folders
        if (Array.isArray(data.folders)) {
            sanitized.folders = data.folders.filter(folder =>
                folder &&
                typeof folder.id === 'string' &&
                typeof folder.name === 'string'
            ).map(folder => ({
                id: folder.id,
                name: folder.name,
                parentId: folder.parentId || null,
                order: typeof folder.order === 'number' ? folder.order : 0
            }));
        }

        // Validate links
        if (Array.isArray(data.links)) {
            sanitized.links = data.links.filter(link =>
                link &&
                typeof link.id === 'string' &&
                typeof link.title === 'string' &&
                typeof link.url === 'string'
            ).map(link => ({
                id: link.id,
                title: link.title,
                url: link.url,
                folderId: link.folderId || null,
                order: typeof link.order === 'number' ? link.order : 0
            }));
        }

        // Validate notes
        if (data.notes && typeof data.notes === 'object') {
            sanitized.notes = {
                content: typeof data.notes.content === 'string' ? data.notes.content : NOTES_DEFAULTS.CONTENT,
                plainContent: typeof data.notes.plainContent === 'string' ? data.notes.plainContent : NOTES_DEFAULTS.PLAIN_CONTENT,
                position: this.validatePosition(data.notes.position),
                size: this.validateSize(data.notes.size),
                formatVersion: data.notes.formatVersion || NOTES_DEFAULTS.FORMAT_VERSION
            };
        }

        log.debug('Data validation completed', {
            foldersValidated: sanitized.folders.length,
            linksValidated: sanitized.links.length,
            notesValidated: !!sanitized.notes
        });

        return sanitized;
    }

    /**
     * Validate position object
     * @param {Object} position - Position data
     * @returns {Object} Validated position
     */
    validatePosition(position) {
        if (position && typeof position === 'object') {
            return {
                x: typeof position.x === 'number' ? Math.max(0, position.x) : NOTES_DEFAULTS.POSITION.x,
                y: typeof position.y === 'number' ? Math.max(0, position.y) : NOTES_DEFAULTS.POSITION.y
            };
        }
        return {
            ...NOTES_DEFAULTS.POSITION
        };
    }

    /**
     * Validate size object
     * @param {Object} size - Size data
     * @returns {Object} Validated size
     */
    validateSize(size) {
        if (size && typeof size === 'object') {
            return {
                width: typeof size.width === 'number' ? Math.max(200, size.width) : NOTES_DEFAULTS.SIZE.width,
                height: typeof size.height === 'number' ? Math.max(150, size.height) : NOTES_DEFAULTS.SIZE.height
            };
        }
        return {
            ...NOTES_DEFAULTS.SIZE
        };
    }

    /**
     * Get default data structure
     * @returns {Object} Default data
     */
    getDefaultData() {
        return {
            folders: [],
            links: [],
            notes: this.getDefaultNotes()
        };
    }

    /**
     * Get default notes structure
     * @returns {Object} Default notes
     */
    getDefaultNotes() {
        return {
            content: NOTES_DEFAULTS.CONTENT,
            plainContent: NOTES_DEFAULTS.PLAIN_CONTENT,
            position: {
                ...NOTES_DEFAULTS.POSITION
            },
            size: {
                ...NOTES_DEFAULTS.SIZE
            },
            formatVersion: NOTES_DEFAULTS.FORMAT_VERSION
        };
    }

    /**
     * Get current data
     * @returns {Object} Current data
     */
    getData() {
        return this.data;
    }

    /**
     * Set data
     * @param {Object} newData - New data to set
     */
    setData(newData) {
        this.data = this.validateAndSanitizeData(newData);
        log.debug('Data updated', {
            folders: this.data.folders.length,
            links: this.data.links.length
        });
    }

    /**
     * Add folder
     * @param {Object} folder - Folder to add
     * @returns {boolean} Success status
     */
    addFolder(folder) {
        try {
            const validatedFolder = {
                id: folder.id || this.generateId(),
                name: folder.name || 'New Folder',
                parentId: folder.parentId || null,
                order: folder.order || this.data.folders.length
            };

            this.data.folders.push(validatedFolder);
            log.info('Folder added', {
                id: validatedFolder.id,
                name: validatedFolder.name
            });

            return true;
        } catch (error) {
            log.error('Failed to add folder', error);
            return false;
        }
    }

    /**
     * Update folder
     * @param {string} id - Folder ID
     * @param {Object} updates - Updates to apply
     * @returns {boolean} Success status
     */
    updateFolder(id, updates) {
        try {
            const folder = this.data.folders.find(f => f.id === id);
            if (!folder) {
                log.warn('Folder not found for update', {
                    id
                });
                return false;
            }

            Object.assign(folder, updates);
            log.info('Folder updated', {
                id,
                updates
            });

            return true;
        } catch (error) {
            log.error('Failed to update folder', error);
            return false;
        }
    }

    /**
     * Delete folder
     * @param {string} id - Folder ID
     * @returns {boolean} Success status
     */
    deleteFolder(id) {
        try {
            const index = this.data.folders.findIndex(f => f.id === id);
            if (index === -1) {
                log.warn('Folder not found for deletion', {
                    id
                });
                return false;
            }

            // Also delete subfolders and links in this folder
            this.deleteSubfolders(id);
            this.data.links = this.data.links.filter(link => link.folderId !== id);
            this.data.folders.splice(index, 1);

            log.info('Folder deleted', {
                id
            });
            return true;
        } catch (error) {
            log.error('Failed to delete folder', error);
            return false;
        }
    }

    /**
     * Delete subfolders recursively
     * @param {string} parentId - Parent folder ID
     */
    deleteSubfolders(parentId) {
        const subfolders = this.data.folders.filter(f => f.parentId === parentId);
        subfolders.forEach(subfolder => {
            this.deleteSubfolders(subfolder.id);
            this.data.links = this.data.links.filter(link => link.folderId !== subfolder.id);
        });
        this.data.folders = this.data.folders.filter(f => f.parentId !== parentId);
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Export data as JSON
     * @returns {string} JSON string
     */
    exportData() {
        try {
            const exportData = {
                ...this.data,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            log.info('Data exported');
            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            log.error('Failed to export data', error);
            throw error;
        }
    }

    /**
     * Import data from JSON
     * @param {string} jsonData - JSON data string
     * @returns {boolean} Success status
     */
    importData(jsonData) {
        try {
            const importedData = JSON.parse(jsonData);
            this.data = this.validateAndSanitizeData(importedData);

            log.info('Data imported successfully', {
                folders: this.data.folders.length,
                links: this.data.links.length
            });

            return true;
        } catch (error) {
            log.error('Failed to import data', error);
            return false;
        }
    }
}

export default DataManager;