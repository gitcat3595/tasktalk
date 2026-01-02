// アプリケーション状態
const app = {
    tasks: [],
    categories: [
        { id: 'work', name: '仕事', color: '#5B8FA3' },
        { id: 'home', name: '家のこと', color: '#7BA883' },
        { id: 'personal', name: '自分のこと', color: '#9B7BA8' },
        { id: 'other', name: 'その他', color: '#B8B8B8' }
    ],
    currentFilter: 'all',
    recognition: null,
    apiKey: null
};

// 初期化
localStorage.removeItem('voicetask_tasks');

// 音声認識の初期化
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // iPhone / Android など未対応なら false（＝後で“音声入力→送信”モードにする）
    if (!SpeechRecognition) {
        console.log('SpeechRecognition not supported -> dictation mode');
        return false;
    }

    app.recognition = new SpeechRecognition();
    app.recognition.lang = 'ja-JP';
    app.recognition.continuous = true;
    app.recognition.interimResults = false;

    let transcript = '';

    app.recognition.onstart = () => {
        document.getElementById('voiceBtn').classList.add('recording');
        document.querySelector('.btn-text').textContent = '録音中';
        const statusText = document.getElementById('statusText');
        statusText.textContent = 'タップして録音を終了';
        statusText.classList.add('recording');
        transcript = '';
    };

    app.recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                transcript += event.results[i][0].transcript;
            }
        }
    };

    app.recognition.onend = () => {
        document.getElementById('voiceBtn').classList.remove('recording');
        document.querySelector('.btn-text').textContent = '話してみる';
        const statusText = document.getElementById('statusText');
        statusText.classList.remove('recording');

        if (transcript.trim()) {
            statusText.textContent = 'リスト作成中...';
            app.tasks = [];
            setTimeout(() => {
                processWithChatGPT(transcript);
                transcript = '';
            }, 50);
        } else {
            statusText.textContent = '内容からやることリストを作ります';
        }
    };

    app.recognition.onerror = (event) => {
        console.error('音声認識エラー:', event.error);
        document.getElementById('voiceBtn').classList.remove('recording');
        document.querySelector('.btn-text').textContent = '話してみる';
        const statusText = document.getElementById('statusText');
        statusText.classList.remove('recording');
        statusText.textContent = '音声認識エラー。マイク許可を確認してください。';
        setTimeout(() => {
            statusText.textContent = '内容からやることリストを作ります';
        }, 2000);
    };

    return true;
}


// ChatGPT APIでタスク抽出
async function processWithChatGPT(text) {
    console.log('🤖 ChatGPT APIでタスク抽出中...\n');
    
    // APIキーのチェック
    if (!app.apiKey) {
        console.log('⚠️ APIキーが設定されていません - ダミーデータを使用');
        useDummyData(text);
        return;
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `あなたはタスク抽出の専門家です。
ユーザーが話した内容から、やるべきタスクを抽出してください。

以下のJSON形式で返してください：
{
  "tasks": [
    {
      "text": "タスクの内容",
      "category": "work" または "home" または "personal" または "other"
    }
  ]
}

カテゴリの判定基準：
- work: 仕事関連（会議、資料、メール、報告など）
- home: 家のこと（買い物、掃除、料理など）
- personal: 自分のこと（ジム、勉強、病院、趣味など）
- other: その他

必ずJSONのみを返し、他の説明は含めないでください。`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                temperature: 0.3
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        console.log('ChatGPT応答:', content);
        
        // JSONをパース
        const result = JSON.parse(content);
        
        console.log('✅ タスク抽出完了:', result.tasks.length, '件\n');
        
        // タスクを作成
        result.tasks.forEach((taskData, index) => {
            console.log(`${index + 1}. 「${taskData.text}」 → ${getCategoryName(taskData.category)}`);
            
            const task = {
                id: Date.now() + Math.random(),
                text: taskData.text,
                category: taskData.category,
                timing: 'later',
                completed: false,
                createdAt: Date.now()
            };
            app.tasks.push(task);
        });
        
        console.log('\n✨ タスク作成完了\n');
        
        saveTasks();
        renderTasks();
        
        document.getElementById('statusText').textContent = `${result.tasks.length}件のタスクを追加しました！`;
        setTimeout(() => {
            document.getElementById('statusText').textContent = '内容からやることリストを作ります';
        }, 3000);
        
    } catch (error) {
        console.error('❌ ChatGPT API エラー:', error);
        document.getElementById('statusText').textContent = 'API エラーが発生しました。ダミーデータを使用します。';
        
        setTimeout(() => {
            useDummyData(text);
        }, 1000);
    }
}

// ダミーデータ（APIキーがない場合のテスト用）
function useDummyData(text) {
    console.log('🧪 ダミーデータを使用してタスクを作成\n');
    
    // ダミーのタスクリスト
    const dummyTasks = [
        { text: '会議の資料を準備する', category: 'work' },
        { text: '牛乳を買いに行く', category: 'home' },
        { text: 'ジムに行く', category: 'personal' },
        { text: 'クライアントに送るプレゼン資料を完成させて、上司に確認してもらってから最終版を提出する', category: 'work' },
        { text: 'スーパーで今週の食材をまとめ買いして、帰りに薬局で洗剤とシャンプーも買ってくる', category: 'home' },
        { text: '英語の勉強を1時間やって、それから読みかけの本を30ページ読み進める', category: 'personal' },
        { text: 'メールを返信する', category: 'work' },
        { text: '部屋を掃除する', category: 'home' }
    ];
    
    dummyTasks.forEach((taskData, index) => {
        console.log(`${index + 1}. 「${taskData.text}」 → ${getCategoryName(taskData.category)}`);
        
        const task = {
            id: Date.now() + Math.random(),
            text: taskData.text,
            category: taskData.category,
            timing: 'later',
            completed: false,
            createdAt: Date.now()
        };
        app.tasks.push(task);
    });
    
    console.log('\n✨ ダミータスク作成完了\n');
    
    saveTasks();
    renderTasks();
    
    document.getElementById('statusText').textContent = `${dummyTasks.length}件のタスクを追加しました（ダミーデータ）`;
    setTimeout(() => {
        document.getElementById('statusText').textContent = '内容からやることリストを作ります';
    }, 3000);
}

// 色を明るくする関数
function lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

// 色を暗くする関数（削除予定）
function darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

// カテゴリ名を取得
function getCategoryName(categoryId) {
    const category = app.categories.find(c => c.id === categoryId);
    return category ? category.name : 'その他';
}

// タスクを描画
function renderTasks() {
    const container = document.getElementById('tasksContainer');
    const filterSection = document.querySelector('.filter-section');
    const header = document.querySelector('header');
    
    let filteredTasks = app.tasks;
    if (app.currentFilter !== 'all') {
        filteredTasks = app.tasks.filter(task => task.timing === app.currentFilter);
    }
    
    const tasksByCategory = {};
    app.categories.forEach(cat => {
        tasksByCategory[cat.id] = filteredTasks.filter(task => task.category === cat.id);
    });
    
    container.innerHTML = '';
    
    // タスクがない場合
    if (app.tasks.length === 0) {
        container.classList.add('hidden');
        filterSection.classList.add('hidden');
        header.classList.remove('hidden');
        return;
    }
    
    // タスクがある場合は表示、ヘッダーは非表示
    container.classList.remove('hidden');
    filterSection.classList.remove('hidden');
    header.classList.add('hidden');
    
    // カテゴリごとに表示（タスクがあるカテゴリのみ）
    app.categories.forEach(category => {
        const tasks = tasksByCategory[category.id];
        
        // タスクがないカテゴリはスキップ
        if (tasks.length === 0) return;
        
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        
        // カテゴリヘッダーに長押しイベントを追加
        let pressTimer;
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        
        // カテゴリカラーとグラデーション設定
        const colorLight = lightenColor(category.color, 15);
        categoryHeader.style.background = `linear-gradient(to right, ${category.color} 0%, ${colorLight} 50%, ${category.color} 100%)`;
        
        categoryHeader.innerHTML = `
            <span>${category.name}</span>
            <span class="task-count" style="color: ${category.color};">${tasks.length}</span>
        `;
        
        // 長押し検出
        categoryHeader.addEventListener('mousedown', () => {
            pressTimer = setTimeout(() => {
                openCategoryEdit(category.id);
            }, 500);
        });
        
        categoryHeader.addEventListener('mouseup', () => {
            clearTimeout(pressTimer);
        });
        
        categoryHeader.addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
        });
        
        // タッチデバイス対応
        categoryHeader.addEventListener('touchstart', () => {
            pressTimer = setTimeout(() => {
                openCategoryEdit(category.id);
            }, 500);
        });
        
        categoryHeader.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
        
        categoryCard.appendChild(categoryHeader);
        
        const tasksList = document.createElement('div');
        tasksList.className = 'tasks-list';
        tasksList.innerHTML = tasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" data-category="${category.id}" draggable="true">
                <div class="task-bubble" style="background-color: ${category.color};" onclick="toggleTask(${task.id})"></div>
                <div class="task-content">
                    <span class="task-text" onclick="editTask(${task.id})" contenteditable="false">${task.text}</span>
                    <div class="task-timing" onclick="cycleTiming(${task.id})">
                        <span class="timing-display">${getTimingLabel(task.timing)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // タスク追加ボタンを追加
        const addButton = document.createElement('button');
        addButton.className = 'add-task-btn';
        addButton.textContent = 'タスクを追加';
        addButton.onclick = () => addNewTask(category.id);
        tasksList.appendChild(addButton);
        
        categoryCard.appendChild(tasksList);
        container.appendChild(categoryCard);
        
        // ドラッグ&ドロップイベント
        setupDragAndDrop();
    });
}

// 完了画面を表示
function showCompletionScreen() {
    const container = document.getElementById('tasksContainer');
    const filterSection = document.querySelector('.filter-section');
    const voiceSection = document.querySelector('.voice-input-section');
    
    container.classList.remove('hidden');
    filterSection.classList.add('hidden');
    voiceSection.classList.add('hidden');
    
    container.innerHTML = `
        <div class="completion-screen">
            <h2 class="completion-title">すべて終わりです<br>おつかれさま！</h2>
            <p class="completion-message">
                これですべてのタスクが完了です<br>
                もう無理と思っても整理すれば大丈夫<br>
                いつでもお手伝いします
            </p>
        </div>
    `;
    
    // バブルエフェクトを大量に発生
    createMassiveBubbleBurst();
}

// 大量のバブル破裂エフェクト
function createMassiveBubbleBurst() {
    const bubbleCount = 50;
    const colors = ['#E8A598', '#D8A5B8', '#C4A8C7', '#A897C4', '#7A9FB5', '#98B4D4'];
    
    for (let i = 0; i < bubbleCount; i++) {
        setTimeout(() => {
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            const angle = Math.random() * 360;
            const distance = 100 + Math.random() * 200;
            const tx = Math.cos(angle * Math.PI / 180) * distance;
            const ty = Math.sin(angle * Math.PI / 180) * distance;
            const size = 15 + Math.random() * 25;
            
            bubble.style.left = x + 'px';
            bubble.style.top = y + 'px';
            bubble.style.width = size + 'px';
            bubble.style.height = size + 'px';
            bubble.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            bubble.style.setProperty('--tx', tx + 'px');
            bubble.style.setProperty('--ty', ty + 'px');
            bubble.style.animationDuration = (1 + Math.random()) + 's';
            
            document.body.appendChild(bubble);
            
            setTimeout(() => bubble.remove(), 2000);
        }, i * 30);
    }
}

// アプリを再起動（録音画面に戻る）
function restartApp() {
    app.tasks = [];
    saveTasks();
    
    const container = document.getElementById('tasksContainer');
    const filterSection = document.querySelector('.filter-section');
    
    container.classList.add('hidden');
    filterSection.classList.add('hidden');
    container.innerHTML = '';
    
    // 音声入力セクションにスクロール
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 新しいタスクを追加
function addNewTask(categoryId) {
    const newTask = {
        id: Date.now() + Math.random(),
        text: '新しいタスク',
        category: categoryId,
        timing: 'later',
        completed: false,
        createdAt: Date.now()
    };
    
    app.tasks.push(newTask);
    saveTasks();
    renderTasks();
    
    // 作成したタスクを即座に編集モードに
    setTimeout(() => {
        editTask(newTask.id);
    }, 100);
}

// タイミングのラベルを取得
function getTimingLabel(timing) {
    switch(timing) {
        case 'today': return '今日';
        case 'week': return '今週';
        case 'later': return 'そのうち';
        default: return 'そのうち';
    }
}

// タイミングをサイクル（タップで切り替え）
function cycleTiming(taskId) {
    const task = app.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const timings = ['later', 'today', 'week'];
    const currentIndex = timings.indexOf(task.timing);
    const nextIndex = (currentIndex + 1) % timings.length;
    
    task.timing = timings[nextIndex];
    saveTasks();
    renderTasks();
}

// ドラッグ&ドロップの設定
function setupDragAndDrop() {
    let draggedElement = null;
    let draggedTaskId = null;
    
    const taskItems = document.querySelectorAll('.task-item');
    const categoryCards = document.querySelectorAll('.category-card');
    
    taskItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            draggedTaskId = parseInt(item.dataset.taskId);
            item.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', (e) => {
            item.style.opacity = '1';
            draggedElement = null;
            draggedTaskId = null;
        });
    });
    
    categoryCards.forEach(card => {
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            card.style.backgroundColor = 'rgba(122, 159, 181, 0.05)';
        });
        
        card.addEventListener('dragleave', (e) => {
            card.style.backgroundColor = '';
        });
        
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.style.backgroundColor = '';
            
            if (!draggedTaskId) return;
            
            // ドロップ先のカテゴリを取得
            const targetCategory = card.querySelector('.tasks-list')?.firstElementChild?.dataset.category ||
                                   app.categories[Array.from(categoryCards).indexOf(card)]?.id;
            
            if (!targetCategory) return;
            
            // タスクのカテゴリを変更
            const task = app.tasks.find(t => t.id === draggedTaskId);
            if (task && task.category !== targetCategory) {
                task.category = targetCategory;
                saveTasks();
                renderTasks();
            }
        });
    });
}

// タスクを編集
function editTask(taskId) {
    const task = app.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const taskElement = document.querySelector(`[data-task-id="${taskId}"] .task-text`);
    taskElement.contentEditable = true;
    taskElement.focus();
    
    // 編集完了時
    taskElement.addEventListener('blur', function handler() {
        taskElement.contentEditable = false;
        task.text = taskElement.textContent.trim();
        saveTasks();
        taskElement.removeEventListener('blur', handler);
    });
    
    // Enterキーで確定
    taskElement.addEventListener('keydown', function handler(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            taskElement.blur();
            taskElement.removeEventListener('keydown', handler);
        }
    });
}

// カテゴリ編集モーダルを開く（個別）
function openCategoryEdit(categoryId) {
    const category = app.categories.find(c => c.id === categoryId);
    if (!category) return;
    
    const modal = document.getElementById('settingsModal');
    const settingsContainer = document.getElementById('categorySettings');
    
    settingsContainer.innerHTML = `
        <div class="category-setting-item">
            <label>カテゴリ名</label>
            <input type="text" value="${category.name}" 
                   onchange="updateCategoryName('${category.id}', this.value)">
            <label>カラー</label>
            <div class="color-options">
                ${getColorOptions().map(color => `
                    <div class="color-option ${category.color === color ? 'selected' : ''}" 
                         style="background-color: ${color};"
                         onclick="updateCategoryColor('${category.id}', '${color}')"></div>
                `).join('')}
            </div>
        </div>
    `;
    
    modal.classList.add('show');
}

// タスクの完了状態を切り替え
function toggleTask(taskId) {
    const task = app.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // タスクを完了状態にマークしてから削除
    task.completed = true;
    
    // バブル破裂エフェクト
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskElement) {
        const rect = taskElement.getBoundingClientRect();
        createBubbleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    
    // 少し遅延してから削除
    setTimeout(() => {
        app.tasks = app.tasks.filter(t => t.id !== taskId);
        saveTasks();
        
        // 全タスク完了チェック
        if (app.tasks.length === 0) {
            showCompletionScreen();
        } else {
            renderTasks();
        }
    }, 300);
}

// バブル破裂エフェクト
function createBubbleBurst(x, y) {
    const bubbleCount = 12;
    const colors = ['#7A9FB5', '#B8D4E0', '#A8C5B8', '#C4A8C7'];
    
    for (let i = 0; i < bubbleCount; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        
        const angle = (360 / bubbleCount) * i;
        const distance = 50 + Math.random() * 50;
        const tx = Math.cos(angle * Math.PI / 180) * distance;
        const ty = Math.sin(angle * Math.PI / 180) * distance;
        
        bubble.style.left = x + 'px';
        bubble.style.top = y + 'px';
        bubble.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        bubble.style.setProperty('--tx', tx + 'px');
        bubble.style.setProperty('--ty', ty + 'px');
        
        document.body.appendChild(bubble);
        
        setTimeout(() => bubble.remove(), 800);
    }
}

// タスクのタイミングを設定
function setTiming(taskId, timing) {
    const task = app.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    task.timing = timing;
    saveTasks();
    renderTasks();
}

// フィルターを設定
function setFilter(filter) {
    app.currentFilter = filter;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const targetBtn = document.querySelector(`[data-filter="${filter}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    renderTasks();
}

// API設定モーダルを開く
function openApiSettings() {
    const modal = document.getElementById('apiSettingsModal');
    const input = document.getElementById('apiKeyInput');
    
    if (app.apiKey) {
        input.value = app.apiKey;
    }
    
    modal.classList.add('show');
}

// APIキーを保存
function saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    const status = document.getElementById('apiKeyStatus');
    const apiKey = input.value.trim();
    
    if (!apiKey) {
        status.textContent = 'APIキーを入力してください';
        status.className = 'api-status error';
        return;
    }
    
    if (!apiKey.startsWith('sk-')) {
        status.textContent = 'APIキーの形式が正しくありません';
        status.className = 'api-status error';
        return;
    }
    
    app.apiKey = apiKey;
    localStorage.setItem('voicetask_apikey', apiKey);
    
    status.textContent = 'APIキーを保存しました！';
    status.className = 'api-status success';
    
    setTimeout(() => {
        document.getElementById('apiSettingsModal').classList.remove('show');
        status.textContent = '';
    }, 2000);
}

// カテゴリ設定モーダルを開く
function openSettings() {
    const modal = document.getElementById('settingsModal');
    const settingsContainer = document.getElementById('categorySettings');
    
    settingsContainer.innerHTML = app.categories.map(category => `
        <div class="category-setting-item">
            <label>カテゴリ名</label>
            <input type="text" value="${category.name}" 
                   onchange="updateCategoryName('${category.id}', this.value)">
            <label>カラー</label>
            <div class="color-options">
                ${getColorOptions().map(color => `
                    <div class="color-option ${category.color === color ? 'selected' : ''}" 
                         style="background-color: ${color};"
                         onclick="updateCategoryColor('${category.id}', '${color}')"></div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    modal.classList.add('show');
}

// カラーオプション
function getColorOptions() {
    return [
        '#B8B8B8', // グレー
        '#7A9FB5', // ブルーグレー
        '#98B4D4', // ライトブルー
        '#8B9DC3', // パープルブルー
        '#A897C4', // パープル
        '#C4A8C7', // パープルグレー
        '#D8A5B8', // ピンクパープル
        '#E8A598', // ピンクグレー
        '#E89B87', // コーラル
        '#E8A876', // ピーチ
        '#D4C4A8', // ベージュ
        '#C4B898', // オリーブ
        '#B4C4A8', // ライトグリーン
        '#A8C5B8'  // グリーングレー
    ];
}

// カテゴリ名を更新
function updateCategoryName(categoryId, newName) {
    const category = app.categories.find(c => c.id === categoryId);
    if (category) {
        category.name = newName;
        saveCategories();
        renderTasks();
        openSettings();
    }
}

// カテゴリカラーを更新
function updateCategoryColor(categoryId, newColor) {
    const category = app.categories.find(c => c.id === categoryId);
    if (category) {
        category.color = newColor;
        saveCategories();
        renderTasks();
        openSettings();
    }
}

// ローカルストレージに保存
function saveTasks() {
    localStorage.setItem('voicetask_tasks', JSON.stringify(app.tasks));
}

function saveCategories() {
    localStorage.setItem('voicetask_categories', JSON.stringify(app.categories));
}

// ローカルストレージから読み込み
function loadTasks() {
    const saved = localStorage.getItem('voicetask_tasks');
    if (saved) {
        app.tasks = JSON.parse(saved);
    }
}

function loadCategories() {
    const saved = localStorage.getItem('voicetask_categories');
    if (saved) {
        app.categories = JSON.parse(saved);
    }
}

function loadApiKey() {
    const saved = localStorage.getItem('voicetask_apikey');
    if (saved) {
        app.apiKey = saved;
        console.log('✅ APIキーが読み込まれました');
    } else {
        console.log('⚠️ APIキーが設定されていません - ダミーデータモードで動作します');
    }
}

// イベントリスナー
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadTasks();
    loadApiKey();

    const statusText = document.getElementById('statusText');
    statusText.textContent = '内容からやることリストを作ります';

    renderTasks();

    const recognitionReady = initSpeechRecognition();

    // 音声入力ボタン
    document.getElementById('voiceBtn').addEventListener('click', () => {
        if (!recognitionReady) {
            alert('このブラウザでは音声認識が使えません');
            return;
        }

        const btn = document.getElementById('voiceBtn');

        try {
            if (btn.classList.contains('recording')) {
                app.recognition.stop();
            } else {
                app.recognition.start(); // ← iPhone/Safari OK
            }
        } catch (e) {
            console.error(e);
            statusText.textContent =
                '音声認識を開始できません。マイク許可を確認してください。';
        }
    });

    // フィルター
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setFilter(btn.dataset.filter);
        });
    });

    // カテゴリ設定
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('show');
    });

    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') {
            document.getElementById('settingsModal').classList.remove('show');
        }
    });
});


