# Bookmark Manager

A lightweight, feature-rich bookmark manager with hierarchical folder organization and integrated note-taking capabilities.

## Features

###  Folder Management
- Create nested folders with unlimited depth
- Drag & drop folders to reorganize hierarchy
- Collapsible folder tree view
- Automatic link count display per folder

###  Link Management
- Add links with automatic title and URL validation
- Drag & drop links between folders
- Automatic favicon fetching
- Quick edit and delete operations

###  Search & Navigation
- Real-time search across all bookmarks
- Search by title or URL
- Clear search results with folder context
- Resizable sidebar for better navigation

###  Integrated Notes
- Floating, resizable notes window
- Auto-save functionality
- Draggable and persistent positioning
- Perfect for quick thoughts and reminders

###  Drag & Drop Interface
- Intuitive drag handles for all elements
- Smooth animations and visual feedback
- Reorder folders and links effortlessly
- Move items between folders seamlessly

###  Data Management
- JSON-based import/export
- Persistent data storage
- Clean, portable data format

###  User Experience
- Clean, modern interface
- Responsive design
- Keyboard shortcuts support

## Installation

1. Clone the repository
2. Set up a PHP-enabled web server
3. Ensure write permissions for data storage
4. Navigate to the application in your browser

## Usage

1. **Create folders** using the "+ Folder" button
2. **Add links** with the "+ Link" button
3. **Organize** by dragging items between folders
4. **Search** using the search bar
5. **Take notes** with the floating notes window
6. **Export/Import** your data as needed

## File Structure

```
bookmark-manager/
├── index.html          # Main application file
├── bookmark_api.php    # Backend API (required)
├── bookmarks.json      # Data storage File (will be created automatically)
└── README.md           # This file
```

## Requirements

- PHP 7.0 or higher
- Web server (Apache, Nginx, etc.)
- Modern web browser with JavaScript enabled

## Data Format

The application uses a simple JSON structure:
```json
{
  "folders": [...],
  "links": [...],
  "notes": {
    "content": "",
    "position": {"x": 50, "y": 100},
    "size": {"width": 300, "height": 400}
  }
}
```

## License

MIT License - feel free to use and modify as needed.

## Contributing

Pull requests welcome! Please ensure your code follows the existing style and includes appropriate comments.