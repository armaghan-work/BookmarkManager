/**
 * Link Manager Component
 * Handles link operations and CRUD functionality
 */

import logger from '../utils/logger.js';
import {
    ELEMENT_IDS,
    VALIDATION_RULES
} from '../constants.js';
import {
    getElementById,
    querySelector,
    clearElement,
    setTextContent
} from '../utils/dom-utils.js';
import errorHandler from '../utils/error-handler.js';

const log = logger.createScope('LinkManager');

class LinkManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentEditId = null;
        this.init();
    }

    /**
     * Initialize link manager
     */
    init() {
        try {
            this.setupEventListeners();
            log.info('Link manager initialized successfully');
        } catch (error) {
            log.error('Failed to initialize link manager', error);
            errorHandler.handleError({
                type: 'ui',
                message: 'Link manager initialization failed',
                error,
                recoverable: true
            });
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for link actions through event delegation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="edit-link"]')) {
                const linkId = e.target.dataset.linkId;
                this.showEditModal(linkId);
            } else if (e.target.matches('[data-action="delete-link"]')) {
                const linkId = e.target.dataset.linkId;
                this.deleteLink(linkId);
            }
        });
    }

    /**
     * Show add link modal
     */
    showAddModal() {
        try {
            this.currentEditId = null;
            this.populateFolderSelect();
            this.clearForm();
            this.showModal('linkModal');

            // Focus on title input
            const titleInput = getElementById('linkTitle');
            if (titleInput) {
                titleInput.focus();
            }

            log.debug('Add link modal shown');
        } catch (error) {
            log.error('Error showing add link modal', error);
        }
    }

    /**
     * Show edit link modal
     * @param {string} linkId - Link ID to edit
     */
    showEditModal(linkId) {
        try {
            const bookmarkData = this.dataManager.getData();
            const link = bookmarkData.links.find(l => l.id === linkId);

            if (!link) {
                log.warn('Link not found for editing', {
                    linkId
                });
                return;
            }

            this.currentEditId = linkId;
            this.populateFolderSelect();
            this.populateForm(link);
            this.showModal('linkModal');

            log.debug('Edit link modal shown', {
                linkId
            });
        } catch (error) {
            log.error('Error showing edit link modal', error);
        }
    }

    /**
     * Save link (add or update)
     */
    async saveLink() {
        try {
            const formData = this.getFormData();

            // Validate form data
            const validation = this.validateLinkData(formData);
            if (!validation.isValid) {
                this.showValidationErrors(validation.errors);
                return;
            }

            const bookmarkData = this.dataManager.getData();

            if (this.currentEditId) {
                // Update existing link
                const link = bookmarkData.links.find(l => l.id === this.currentEditId);
                if (link) {
                    Object.assign(link, formData);
                    log.info('Link updated', {
                        id: this.currentEditId,
                        title: formData.title
                    });
                }
            } else {
                // Add new link
                const newLink = {
                    id: this.generateId(),
                    ...formData,
                    order: bookmarkData.links.filter(l => l.folderId === formData.folderId).length
                };

                bookmarkData.links.push(newLink);
                log.info('Link added', {
                    id: newLink.id,
                    title: newLink.title
                });
            }

            // Save data
            await this.dataManager.saveData();

            // Close modal and refresh UI
            this.closeModal('linkModal');
            this.notifyLinkChange();

        } catch (error) {
            log.error('Error saving link', error);
            errorHandler.handleError({
                type: 'storage',
                message: 'Failed to save link',
                error,
                recoverable: true
            });
        }
    }

    /**
     * Delete link
     * @param {string} linkId - Link ID to delete
     */
    async deleteLink(linkId) {
        try {
            const bookmarkData = this.dataManager.getData();
            const link = bookmarkData.links.find(l => l.id === linkId);

            if (!link) {
                log.warn('Link not found for deletion', {
                    linkId
                });
                return;
            }

            // Confirm deletion
            if (!confirm(`Delete link "${link.title}"?`)) {
                return;
            }

            // Remove link
            const index = bookmarkData.links.findIndex(l => l.id === linkId);
            if (index !== -1) {
                bookmarkData.links.splice(index, 1);

                // Save data
                await this.dataManager.saveData();

                // Refresh UI
                this.notifyLinkChange();

                log.info('Link deleted', {
                    id: linkId,
                    title: link.title
                });
            }

        } catch (error) {
            log.error('Error deleting link', error);
            errorHandler.handleError({
                type: 'storage',
                message: 'Failed to delete link',
                error,
                recoverable: true
            });
        }
    }

    /**
     * Get form data
     * @returns {Object} Form data
     */
    getFormData() {
        const titleInput = getElementById('linkTitle');
        const urlInput = getElementById('linkUrl');
        const folderSelect = getElementById('linkFolder');

        return {
            title: titleInput ? titleInput.value.trim() : '',
            url: urlInput ? urlInput.value.trim() : '',
            folderId: folderSelect ? folderSelect.value || null : null
        };
    }

    /**
     * Validate link data
     * @param {Object} data - Link data to validate
     * @returns {Object} Validation result
     */
    validateLinkData(data) {
        const errors = [];

        // Validate title
        if (!data.title) {
            errors.push('Title is required');
        } else if (data.title.length < VALIDATION_RULES.MIN_LINK_TITLE_LENGTH) {
            errors.push(`Title must be at least ${VALIDATION_RULES.MIN_LINK_TITLE_LENGTH} character(s)`);
        } else if (data.title.length > VALIDATION_RULES.MAX_LINK_TITLE_LENGTH) {
            errors.push(`Title must be less than ${VALIDATION_RULES.MAX_LINK_TITLE_LENGTH} characters`);
        }

        // Validate URL
        if (!data.url) {
            errors.push('URL is required');
        } else {
            try {
                new URL(data.url);
                if (data.url.length > VALIDATION_RULES.MAX_URL_LENGTH) {
                    errors.push(`URL must be less than ${VALIDATION_RULES.MAX_URL_LENGTH} characters`);
                }
            } catch (error) {
                errors.push('Please enter a valid URL');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Show validation errors
     * @param {Array} errors - Array of error messages
     */
    showValidationErrors(errors) {
        // Remove existing error messages
        const existingErrors = document.querySelectorAll('.validation-error');
        existingErrors.forEach(error => error.remove());

        // Show new errors
        errors.forEach(error => {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'validation-error';
            errorDiv.style.cssText = 'color: red; font-size: 12px; margin-top: 4px;';
            errorDiv.textContent = error;

            // Add to modal content
            const modalContent = querySelector('#linkModal .modal-content');
            if (modalContent) {
                modalContent.insertBefore(errorDiv, modalContent.querySelector('.form-actions'));
            }
        });

        log.debug('Validation errors shown', {
            count: errors.length
        });
    }

    /**
     * Populate folder select dropdown
     */
    populateFolderSelect() {
        const folderSelect = getElementById('linkFolder');
        if (!folderSelect) return;

        clearElement(folderSelect);

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select folder...';
        folderSelect.appendChild(defaultOption);

        // Add folder options
        const bookmarkData = this.dataManager.getData();
        const folders = bookmarkData.folders
            .filter(folder => !folder.parentId) // Only root folders for now
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.name;
            folderSelect.appendChild(option);
        });

        log.debug('Folder select populated', {
            count: folders.length
        });
    }

    /**
     * Populate form with link data
     * @param {Object} link - Link data
     */
    populateForm(link) {
        const titleInput = getElementById('linkTitle');
        const urlInput = getElementById('linkUrl');
        const folderSelect = getElementById('linkFolder');

        if (titleInput) titleInput.value = link.title || '';
        if (urlInput) urlInput.value = link.url || '';
        if (folderSelect) folderSelect.value = link.folderId || '';
    }

    /**
     * Clear form
     */
    clearForm() {
        const titleInput = getElementById('linkTitle');
        const urlInput = getElementById('linkUrl');
        const folderSelect = getElementById('linkFolder');

        if (titleInput) titleInput.value = '';
        if (urlInput) urlInput.value = '';
        if (folderSelect) folderSelect.value = '';

        // Remove validation errors
        const errors = document.querySelectorAll('.validation-error');
        errors.forEach(error => error.remove());
    }

    /**
     * Show modal
     * @param {string} modalId - Modal ID to show
     */
    showModal(modalId) {
        const modal = getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * Close modal
     * @param {string} modalId - Modal ID to close
     */
    closeModal(modalId) {
        const modal = getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }

        // Clear form when closing
        if (modalId === 'linkModal') {
            this.clearForm();
            this.currentEditId = null;
        }
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return 'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Notify other components of link changes
     */
    notifyLinkChange() {
        const event = new CustomEvent('linksChanged', {
            detail: {
                timestamp: Date.now()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Import links from data
     * @param {Array} links - Links to import
     * @returns {boolean} Success status
     */
    importLinks(links) {
        try {
            if (!Array.isArray(links)) {
                throw new Error('Links must be an array');
            }

            const bookmarkData = this.dataManager.getData();
            let importedCount = 0;

            links.forEach(linkData => {
                const validation = this.validateLinkData(linkData);
                if (validation.isValid) {
                    const newLink = {
                        id: linkData.id || this.generateId(),
                        title: linkData.title,
                        url: linkData.url,
                        folderId: linkData.folderId || null,
                        order: linkData.order || bookmarkData.links.length + importedCount
                    };

                    bookmarkData.links.push(newLink);
                    importedCount++;
                } else {
                    log.warn('Invalid link data during import', {
                        linkData,
                        errors: validation.errors
                    });
                }
            });

            log.info('Links imported', {
                count: importedCount
            });
            return true;

        } catch (error) {
            log.error('Error importing links', error);
            return false;
        }
    }

    /**
     * Export links
     * @returns {Array} Links data
     */
    exportLinks() {
        const bookmarkData = this.dataManager.getData();
        return bookmarkData.links.map(link => ({
            id: link.id,
            title: link.title,
            url: link.url,
            folderId: link.folderId,
            order: link.order
        }));
    }
}

export default LinkManager;