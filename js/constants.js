/**
 * Application Constants
 * Centralized configuration and magic numbers
 */

export const NOTES_DEFAULTS = {
    POSITION: {
        x: 50,
        y: 100
    },
    SIZE: {
        width: 300,
        height: 400
    },
    FORMAT_VERSION: '1.0',
    CONTENT: '<p></p>',
    PLAIN_CONTENT: ''
};

export const UI_CONSTANTS = {
    AUTO_SAVE_DELAY: 1000,
    RESIZE_SAVE_DELAY: 500,
    ANIMATION_DURATION: 150,
    DEBOUNCE_DELAY: 300
};

export const FOLDER_ICONS = {
    CLOSED: '📁',
    OPEN: '📂'
};

export const DRAG_HANDLE = '≡';

export const API_ENDPOINTS = {
    LOAD: '?action=load',
    SAVE: 'bookmark_api.php'
};

export const CSS_CLASSES = {
    FOLDER: 'folder',
    EXPANDED: 'expanded',
    SELECTED: 'selected',
    DRAG_GHOST: 'drag-ghost',
    DRAG_HANDLE: 'drag-handle',
    EMPTY_STATE: 'empty-state'
};

export const ELEMENT_IDS = {
    FOLDER_LIST: 'folderList',
    LINK_LIST: 'linkList',
    NOTES_WINDOW: 'notesWindow',
    NOTES_EDITOR: 'notesEditor',
    NOTES_HEADER: 'notesHeader',
    SEARCH_INPUT: 'searchInput'
};

export const KEYBOARD_SHORTCUTS = {
    ESCAPE: 'Escape',
    ENTER: 'Enter',
    CTRL_B: 'ctrl+b',
    CTRL_I: 'ctrl+i',
    CTRL_S: 'ctrl+s'
};

export const ERROR_MESSAGES = {
    LOAD_FAILED: 'Failed to load bookmark data',
    SAVE_FAILED: 'Failed to save bookmark data',
    EDITOR_NOT_FUNCTIONAL: 'Notes editor is not functional',
    INVALID_FOLDER_ID: 'Invalid folder ID provided',
    NETWORK_ERROR: 'Network error occurred'
};

export const SUCCESS_MESSAGES = {
    DATA_SAVED: 'Data saved successfully',
    FOLDER_CREATED: 'Folder created successfully',
    LINK_ADDED: 'Link added successfully'
};

export const VALIDATION_RULES = {
    MAX_FOLDER_NAME_LENGTH: 100,
    MAX_LINK_TITLE_LENGTH: 200,
    MAX_URL_LENGTH: 2000,
    MIN_FOLDER_NAME_LENGTH: 1,
    MIN_LINK_TITLE_LENGTH: 1
};

export const MIME_TYPES = {
    JSON: 'application/json',
    TEXT: 'text/plain'
};

export const HTTP_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE'
};

export const STORAGE_KEYS = {
    BOOKMARK_DATA: 'bookmarkData',
    USER_PREFERENCES: 'userPreferences',
    LAST_BACKUP: 'lastBackup'
};