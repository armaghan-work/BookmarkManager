<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dataFile = 'bookmarks.json';

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
                'content' => '',
                'position' => ['x' => 50, 'y' => 100],
                'size' => ['width' => 300, 'height' => 400]
            ];
        }
        
        return $data;
    }
    
    return [
        'folders' => [],
        'links' => [],
        'notes' => [
            'content' => '',
            'position' => ['x' => 50, 'y' => 100],
            'size' => ['width' => 300, 'height' => 400]
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
            'content' => '',
            'position' => ['x' => 50, 'y' => 100],
            'size' => ['width' => 300, 'height' => 400]
        ];
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