<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dataFile = 'bookmarks.json';

function migrateNotesToRichText($notes) {
    // Check if migration is needed (no formatVersion or version < 1.0)
    if (!isset($notes['formatVersion']) || version_compare($notes['formatVersion'], '1.0', '<')) {
        error_log('Migrating notes to rich text format...');
        
        // Convert plain text content to HTML
        $htmlContent = '';
        $plainContent = '';
        
        if (isset($notes['content']) && is_string($notes['content'])) {
            $plainContent = $notes['content'];
            // Convert plain text to HTML by wrapping in paragraphs and preserving line breaks
            $lines = array_filter(array_map('trim', explode("\n", $notes['content'])), function($line) {
                return strlen($line) > 0;
            });
            
            if (!empty($lines)) {
                $htmlContent = '<p>' . implode('</p><p>', array_map('htmlspecialchars', $lines)) . '</p>';
            } else {
                $htmlContent = '<p></p>';
            }
        } else {
            $htmlContent = '<p></p>';
            $plainContent = '';
        }
        
        // Create new enhanced notes structure
        $migratedNotes = [
            'content' => $htmlContent,
            'plainContent' => $plainContent,
            'position' => isset($notes['position']) ? $notes['position'] : ['x' => 50, 'y' => 100],
            'size' => isset($notes['size']) ? $notes['size'] : ['width' => 300, 'height' => 400],
            'formatVersion' => '1.0'
        ];
        
        error_log('Notes migration completed');
        return $migratedNotes;
    }
    
    // Already migrated, ensure all required properties exist
    return [
        'content' => isset($notes['content']) ? $notes['content'] : '<p></p>',
        'plainContent' => isset($notes['plainContent']) ? $notes['plainContent'] : '',
        'position' => isset($notes['position']) ? $notes['position'] : ['x' => 50, 'y' => 100],
        'size' => isset($notes['size']) ? $notes['size'] : ['width' => 300, 'height' => 400],
        'formatVersion' => isset($notes['formatVersion']) ? $notes['formatVersion'] : '1.0'
    ];
}

function loadData() {
    global $dataFile;
    if (file_exists($dataFile)) {
        $content = file_get_contents($dataFile);
        $data = json_decode($content, true);
        
        // Ensure all required properties exist
        if (!$data) {
            $data = [];
        }
        
        if (!isset($data['folders'])) {
            $data['folders'] = [];
        }
        
        if (!isset($data['links'])) {
            $data['links'] = [];
        }
        
        if (!isset($data['notes'])) {
            $data['notes'] = [
                'content' => '<p></p>',
                'plainContent' => '',
                'position' => ['x' => 50, 'y' => 100],
                'size' => ['width' => 300, 'height' => 400],
                'formatVersion' => '1.0'
            ];
        } else {
            // Migrate existing notes if needed
            $data['notes'] = migrateNotesToRichText($data['notes']);
        }
        
        return $data;
    }
    
    return [
        'folders' => [],
        'links' => [],
        'notes' => [
            'content' => '<p></p>',
            'plainContent' => '',
            'position' => ['x' => 50, 'y' => 100],
            'size' => ['width' => 300, 'height' => 400],
            'formatVersion' => '1.0'
        ]
    ];
}

function saveData($data) {
    global $dataFile;
    
    // Ensure all required properties exist
    if (!isset($data['folders'])) {
        $data['folders'] = [];
    }
    
    if (!isset($data['links'])) {
        $data['links'] = [];
    }
    
    if (!isset($data['notes'])) {
        $data['notes'] = [
            'content' => '<p></p>',
            'plainContent' => '',
            'position' => ['x' => 50, 'y' => 100],
            'size' => ['width' => 300, 'height' => 400],
            'formatVersion' => '1.0'
        ];
    } else {
        // Ensure notes are in the correct format when saving
        $data['notes'] = migrateNotesToRichText($data['notes']);
    }
    
    $json = json_encode($data, JSON_PRETTY_PRINT);
    $result = file_put_contents($dataFile, $json);
    
    return $result !== false;
}

// Handle requests
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['action']) && $_GET['action'] === 'load') {
        $data = loadData();
        echo json_encode(['success' => true, 'data' => $data]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'save') {
        $success = saveData($input['data']);
        echo json_encode(['success' => $success]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>