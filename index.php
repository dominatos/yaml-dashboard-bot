<?php
define('APP_VERSION', '0.2.0');
// Function to safely parse YAML using Python (avoids dependency on php-yaml extension)
function parse_yaml_file($file) {
    if (!file_exists($file)) return null;
    
    // Read the file in PHP to avoid shell redirection issues
    $yamlContent = file_get_contents($file);
    if ($yamlContent === false) return null;

    $spec = [
        0 => ["pipe", "r"],
        1 => ["pipe", "w"],
        2 => ["pipe", "w"]
    ];
    
    // proc_open is safer and explicitly handles stdin/stdout
    $process = proc_open("python3 -c 'import yaml, json, sys; json.dump(yaml.safe_load(sys.stdin), sys.stdout)'", $spec, $pipes);
    
    if (is_resource($process)) {
        fwrite($pipes[0], $yamlContent);
        fclose($pipes[0]);
        $json = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);
        
        if ($json) {
            $data = json_decode($json, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $data;
            }
        }
    }
    return null;
}

// Safely normalize link target properties
function getLinkAttributes($target) {
    $target = strtolower(trim((string)$target));
    if ($target === 'newtab' || $target === 'blank' || empty($target)) {
        return 'target="_blank" rel="noopener noreferrer"';
    } elseif ($target === 'sametab') {
        return 'target="_self"';
    }
    return 'target="_blank" rel="noopener noreferrer"';
}

// Extract valid URLs ignoring markdown artifacts like [Title](url)
function sanitizeUrl($url) {
    $url = trim((string)$url);
    if (preg_match('/^\[(.*?)\]\((.*?)\)$/', $url, $matches)) {
        $url = $matches[2];
    }
    
    $url = trim($url);
    $url = preg_replace('/[\x00-\x1F\x7F]/', '', $url);
    
    $parsed = parse_url($url);
    if ($parsed && !empty($parsed['scheme'])) {
        $scheme = strtolower($parsed['scheme']);
        if (!in_array($scheme, ['http', 'https', 'mailto'])) {
            return '';
        }
    } else {
        $lowerUrl = strtolower($url);
        if (strpos($lowerUrl, 'javascript:') === 0 || strpos($lowerUrl, 'data:') === 0 || strpos($lowerUrl, 'vbscript:') === 0) {
            return '';
        }
    }
    
    return $url;
}

// Load the exact same conf.yml used for Dashy!
$config = parse_yaml_file(__DIR__ . '/conf.yml');

if (!$config) {
    die("<h2 style='color:white;text-align:center;font-family:sans-serif;'>Could not load or parse conf.yml. Make sure it exists, is valid YAML, and python3 + python3-yaml are installed!</h2>");
}

// Mapping for specific premium gradients/icons
$specialIconMap = [
    'tandoor' => ['grad' => 'grad-warning', 'svg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'],
    'grocy' => ['grad' => 'grad-success', 'svg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>'],
    'n8n' => ['grad' => 'grad-danger', 'svg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>'],
    'jellyfin' => ['grad' => 'grad-purple', 'svg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>'],
    'qbittorrent' => ['grad' => 'grad-blue', 'svg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'],
    'ghostfolio' => ['grad' => 'grad-slate', 'svg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>'],
    'actualbudget' => ['grad' => 'grad-indigo', 'svg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>'],
    'local' => ['grad' => 'grad-info', 'svg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>'],
];

function renderIcon($iconStr) {
    global $specialIconMap;
    $iconStr = strtolower(trim((string)$iconStr));
    
    if (!preg_match('/^(si-|mdi-|hl-|fas |fab |far |fa |)[a-z0-9\-_]+$/', $iconStr)) {
        $iconStr = '';
    }
    
    // Clean up prefix for checking special map
    $name = preg_replace('/^(si-|hl-|fas |fab |far |fa |mdi-)/', '', $iconStr);
    $name = str_replace([' ', '-', '_'], '', $name);
    
    // Pick a gradient based on the name hash if not special
    $gradients = ['grad-primary', 'grad-blue', 'grad-success', 'grad-warning', 'grad-danger', 'grad-purple', 'grad-indigo', 'grad-slate', 'grad-info'];
    $gradientClass = $gradients[abs(crc32($name)) % count($gradients)];
    $iconContent = '';

    if ($name !== '' && isset($specialIconMap[$name])) {
        $gradientClass = $specialIconMap[$name]['grad'];
        $iconContent = $specialIconMap[$name]['svg'];
    } elseif (strpos($iconStr, 'si-') === 0) {
        // Simple Icons fallback via CDN
        $siName = htmlspecialchars(substr($iconStr, 3), ENT_QUOTES, 'UTF-8');
        $iconContent = "<img src=\"https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/{$siName}.svg\" style=\"width: 28px; height: 28px; filter: brightness(0) invert(1);\" loading=\"lazy\" alt=\"{$siName} icon\">";
    } elseif (strpos($iconStr, 'fa') === 0) {
        // Font Awesome fallback
        $escapedFa = htmlspecialchars($iconStr, ENT_QUOTES, 'UTF-8');
        $iconContent = "<i class=\"{$escapedFa}\" style=\"font-size: 24px;\"></i>";
    } elseif (strpos($iconStr, 'mdi-') === 0) {
        // Material Design Icons generic fallback
        $iconContent = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>';
    } else {
        // Default lucide-like circle fallback
        $iconContent = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8M8 12h8"></path></svg>';
    }

    return "<div class=\"card-icon {$gradientClass}\">{$iconContent}</div>";
}

function determineBtnClass($label) {
    $l = strtolower($label);
    if (strpos($l, 'local') !== false) return 'btn-local';
    if (strpos($l, 'public') !== false) return 'btn-public';
    if (strpos($l, 'network') !== false) return 'btn-network';
    return 'btn-public'; // fallback
}

$pageInfo = $config['pageInfo'] ?? [];
$sections = $config['sections'] ?? [];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageInfo['title'] ?? 'Home Server'); ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg-dark: #09090b;
            --card-bg: rgba(24, 24, 27, 0.4);
            --border: rgba(255, 255, 255, 0.08);
            --primary: #ffffff;
            --secondary: #a1a1aa;
            --btn-bg: rgba(255, 255, 255, 0.05);
            --btn-hover: rgba(255, 255, 255, 0.1);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-dark);
            color: var(--primary);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            overflow-x: hidden;
            padding: 2rem 0;
        }

        .background {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            z-index: -1; overflow: hidden; background: #09090b;
        }
        .blob {
            position: absolute; filter: blur(100px); opacity: 0.5;
            animation: float 20s infinite ease-in-out alternate;
        }
        .blob-1 {
            top: -10%; left: -10%; width: 50vw; height: 50vw;
            background: radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(0,0,0,0) 70%);
        }
        .blob-2 {
            bottom: -10%; right: -10%; width: 60vw; height: 60vw;
            background: radial-gradient(circle, rgba(56,189,248,0.3) 0%, rgba(0,0,0,0) 70%);
            animation-delay: -5s;
        }
        .blob-3 {
            top: 40%; left: 50%; width: 40vw; height: 40vw;
            background: radial-gradient(circle, rgba(236,72,153,0.2) 0%, rgba(0,0,0,0) 70%);
            animation-delay: -10s;
        }
        @keyframes float {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(10%, 10%) scale(1.1); }
        }

        .container {
            width: 100%;
            max-width: 1800px;
            padding: 2rem;
            z-index: 1;
            margin: 0 auto;
        }

        header { text-align: center; margin-bottom: 4rem; }
        h1 {
            font-size: 3.5rem; font-weight: 800; margin-bottom: 0.5rem;
            background: linear-gradient(to right, #fff, #a1a1aa);
            background-clip: text; -webkit-background-clip: text;
            -webkit-text-fill-color: transparent; letter-spacing: -1px;
        }
        p.subtitle { color: var(--secondary); font-size: 1.2rem; font-weight: 300; }

        .top-nav {
            margin-top: 1.5rem; display: flex; flex-wrap: wrap; justify-content: center; gap: 1.0rem;
        }
        .nav-link {
            color: var(--primary); text-decoration: none; font-size: 1.1rem;
            font-weight: 600; padding: 0.5rem 1rem; border-radius: 8px;
            background: var(--btn-bg); border: 1px solid var(--border);
            transition: all 0.2s;
        }
        .nav-link:hover { background: var(--btn-hover); transform: translateY(-2px); border-color: rgba(255,255,255,0.2); }

        .section-wrap { margin-bottom: 4rem; }
        .section-title {
            display: flex; align-items: center; font-size: 1.8rem;
            font-weight: 600; margin-bottom: 1.5rem; color: #fff;
        }
        .section-title i { margin-right: 12px; color: var(--secondary); font-size: 1.5rem; opacity: 0.8; }

        .grid {
            display: grid;
            gap: 1.5rem;
            width: 100%;
            justify-content: center;
            /* Using auto-fit and a capped minmax to allow centering when items are few */
            grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 420px));
        }

        /* On ultra-wide screens, we can allow even more columns if the YAML allows it */
        @media (min-width: 1800px) {
            .grid {
                grid-template-columns: repeat(auto-fit, minmax(380px, 440px));
                justify-content: center;
            }
        }

        /* Ensure sections are centered as a block */
        .section-wrap {
            max-width: 100%;
            margin-bottom: 4rem;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .card {
            background: var(--card-bg); border: 1px solid var(--border);
            border-radius: 24px; padding: 2rem; backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex; flex-direction: column; position: relative; overflow: hidden;
            min-width: 0; /* fixes flex breakout */
        }
        .card::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transform: translateX(-100%); transition: transform 0.5s ease;
        }
        .card:hover {
            transform: translateY(-5px); border-color: rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 40px -10px rgba(0,0,0,0.5); background: rgba(24, 24, 27, 0.6);
        }
        .card:hover::before { transform: translateX(100%); }

        .card-icon {
            width: 56px; height: 56px; border-radius: 16px; display: flex;
            justify-content: center; align-items: center; margin-bottom: 1.5rem;
            box-shadow: 0 8px 16px -4px rgba(0,0,0,0.2); flex-shrink: 0;
        }
        .card-icon svg { width: 28px; height: 28px; }

        .grad-primary { background: linear-gradient(135deg, #a1a1aa, #52525b); color: white; }
        .grad-warning { background: linear-gradient(135deg, #fbbf24, #d97706); color: white; }
        .grad-success { background: linear-gradient(135deg, #34d399, #059669); color: white; }
        .grad-danger { background: linear-gradient(135deg, #fb7185, #e11d48); color: white; }
        .grad-blue { background: linear-gradient(135deg, #60a5fa, #2563eb); color: white; }
        .grad-purple { background: linear-gradient(135deg, #c084fc, #9333ea); color: white; }
        .grad-orange { background: linear-gradient(135deg, #fb923c, #f97316); color: white; }
        .grad-red { background: linear-gradient(135deg, #f43f5e, #be123c); color: white; }
        .grad-info { background: linear-gradient(135deg, #22d3ee, #0891b2); color: white; }
        .grad-slate { background: linear-gradient(135deg, #94a3b8, #475569); color: white; }
        .grad-indigo { background: linear-gradient(135deg, #818cf8, #4f46e5); color: white; }
        .grad-violet { background: linear-gradient(135deg, #a78bfa, #7c3aed); color: white; }

        h2.card-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; letter-spacing: -0.5px; }
        p.card-desc { color: var(--secondary); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.4; flex-grow: 1; }

        .links { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: auto; }

        .btn {
            display: inline-flex; align-items: center; padding: 0.6rem 1rem;
            background: var(--btn-bg); color: var(--primary); text-decoration: none;
            border-radius: 12px; font-size: 0.95rem; font-weight: 400;
            border: 1px solid var(--border); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn:hover {
            background: var(--btn-hover); border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .btn-local::before { content: '🏠'; margin-right: 8px; font-size: 1.1em; }
        .btn-network::before { content: '🖥️'; margin-right: 8px; font-size: 1.1em; }
        .btn-public::before { content: '🌍'; margin-right: 8px; font-size: 1.1em; }
        .btn-code::before { content: '💻'; margin-right: 8px; font-size: 1.1em; }

        @media (max-width: 768px) {
            h1 { font-size: 2.5rem; }
            .container { padding: 1.5rem; }
        }
    </style>
</head>
<body>
    <div class="background">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
    </div>
    
    <div class="container">
        <header>
            <h1><?php echo htmlspecialchars($pageInfo['title'] ?? 'Home Server'); ?></h1>
            <p class="subtitle"><?php echo htmlspecialchars($pageInfo['description'] ?? ''); ?></p>
            
            <?php if (!empty($pageInfo['navLinks'])): ?>
            <div class="top-nav">
                <?php foreach ($pageInfo['navLinks'] as $nav): 
                    $url = sanitizeUrl($nav['path'] ?? '#');
                ?>
                    <a href="<?php echo htmlspecialchars($url); ?>" <?php echo getLinkAttributes($nav['target'] ?? ''); ?> class="nav-link">
                        <?php echo htmlspecialchars($nav['title'] ?? 'Link'); ?>
                    </a>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </header>

        <?php foreach ($sections as $section): ?>
            <div class="section-wrap">
                <?php if (!empty($section['name'])): ?>
                    <div class="section-title">
                        <?php if (!empty($section['icon'])): ?>
                            <i class="<?php echo htmlspecialchars($section['icon']); ?>"></i>
                        <?php endif; ?>
                        <?php echo htmlspecialchars($section['name']); ?>
                    </div>
                <?php endif; ?>

                <div class="grid">
                    <?php if (!empty($section['items'])): ?>
                        <?php foreach ($section['items'] as $item): ?>
                            <div class="card">
                                <?php echo renderIcon($item['icon'] ?? ''); ?>
                                <h2 class="card-title"><?php echo htmlspecialchars($item['title']); ?></h2>
                                <?php if (!empty($item['description'])): ?>
                                    <p class="card-desc"><?php echo htmlspecialchars($item['description']); ?></p>
                                <?php endif; ?>

                                <div class="links">
                                    <?php 
                                        if (!empty($item['subItems'])) {
                                            foreach ($item['subItems'] as $subItem) {
                                                $url = sanitizeUrl($subItem['url'] ?? '#');
                                                $targetMatch = getLinkAttributes($subItem['target'] ?? $item['target'] ?? '');
                                                $type = determineBtnClass($subItem['title'] ?? '');
                                                echo '<a href="' . htmlspecialchars($url) . '" class="btn ' . $type . '" ' . $targetMatch . '>' . htmlspecialchars($subItem['title'] ?? 'Link') . '</a>';
                                            }
                                        } elseif (!empty($item['url'])) {
                                            $url = sanitizeUrl($item['url']);
                                            $targetMatch = getLinkAttributes($item['target'] ?? '');
                                            $type = determineBtnClass('Open');
                                            echo '<a href="' . htmlspecialchars($url) . '" class="btn ' . $type . '" ' . $targetMatch . '>Open</a>';
                                        }
                                    ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>

        <?php if (!empty($pageInfo['footerText'])): ?>
            <footer style="text-align: center; margin-top: 4rem; color: var(--secondary); font-size: 0.9rem;">
                <?php echo htmlspecialchars($pageInfo['footerText']); ?>
                <div style="margin-top: 0.5rem; opacity: 0.5; font-size: 0.8rem;">v<?php echo APP_VERSION; ?></div>
            </footer>
        <?php endif; ?>
    </div>
</body>
</html>

<!-- codded by https://github.com/dominatos -->
