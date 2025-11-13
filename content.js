// 辅助函数：生成UUID
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 辅助函数：延迟
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCookies(name) {
    try {
        const url = window.location.origin;
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'getCookies',
                fieldName: name,
                url: url
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[getCookies] error:', chrome.runtime.lastError);
                    // 如果background script不可用，回退到document.cookie
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    const cookieValue = parts.length === 2 ? parts.pop().split(';').shift() : '';
                    resolve(cookieValue);
                    return;
                }
                
                if (response && response.error) {
                    console.error('[getCookies] error from background:', response.error);
                    // 回退到document.cookie
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    const cookieValue = parts.length === 2 ? parts.pop().split(';').shift() : '';
                    resolve(cookieValue);
                    return;
                }
                
                resolve(response?.fieldValue || '');
            });
        });
    } catch (error) {
        console.error('[getCookies] error:', error);
        // 回退到document.cookie
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        return parts.length === 2 ? parts.pop().split(';').shift() : '';
    }
}

// 辅助函数：根据obj_type获取文件类型
function getFileTypeByObjType(obj_type) {
    switch (obj_type) {
        case 8: // 多维表
            return 'bitable';
        case 3: // 简单表格
            return 'sheet';
        case 30: // 幻灯片
            return 'slides';
        case 2:
            return 'doc';
        case 22: // 文档、文档画板
            return 'docx';
        case 11: // 思维笔记
            return 'mindnote';
        default:
            return '';
    }
}

// 辅助函数：根据obj_type获取文件扩展名
function getFileExtensionByObjType(obj_type) {
    switch (obj_type) {
        case 8: // 问卷、多维表
            return 'xlsx';
        case 3: // 简单表格
            return 'xlsx';
        case 30: // 幻灯片
            return 'pptx';
        case 2:
        case 22: // 文档、文档画板
            return 'docx';
        case 11: // 思维笔记
            return 'mm';
        default:
            return 'pdf';
    }
}

// 获取导出结果（使用与参考代码相同的API端点）
async function fetchExportResult(ticket, token, obj_type) {
    console.log(`[fetchExportResult] fetching export result for ticket: ${ticket}`);
    
    if (!ticket) {
        console.warn('[fetchExportResult] ticket is null');
        return null;
    }
    
    try {
        // 使用参考代码的API端点格式
        const url = `${window.location.origin}/space/api/export/result/${ticket}?token=${token}&type=${getFileTypeByObjType(obj_type)}&synced_block_host_token=${token}&synced_block_host_type=${getFileTypeByObjType(obj_type)}`;
        console.log(`[fetchExportResult] request URL: ${url}`);
        
        // 使用简单的GET请求，与参考代码一致
        const resp = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!resp.ok) {
            console.error(`[fetchExportResult] HTTP error! status: ${resp.status}`);
            throw new Error(`HTTP error! status: ${resp.status}`);
        }
        
        const json = await resp.json();
        console.log('[fetchExportResult] successfully fetched export result:', json);
        return json;
    } catch (error) {
        console.error('[fetchExportResult] error:', error);
        throw error;
    }
}

// 创建导出任务
async function createExportTask(data) {
    console.log('[createExportTask] creating export task with data:', data);
    try {
        await sleep(500);
        const requestId = 'bbAtOlQGYEbs-' + uuidv4().replace(/-/g, '');
        
        const requestData = {
            "token": data.token,
            "type": getFileTypeByObjType(data.obj_type),
            "file_extension": getFileExtensionByObjType(data.obj_type),
            "event_source": 1,
            "need_comment": false
        };
        
        const csrfToken = await getCookies('_csrf_token');
        
        let resp = await fetch(`${window.location.origin}/space/api/export/create/?synced_block_host_token=${data.token}&synced_block_host_type=${getFileTypeByObjType(data.obj_type)}`, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "accept-language": "zh-CN,zh;q=0.9",
                "content-type": "application/json",
                "context": `${requestId};os=mac;app_version=1.0.13.3784;os_version=10.15.7;platform=web`,
                "doc-biz": "Lark",
                "pragma": "no-cache",
                "request-id": requestId,
                "rpc-persist-lane-c-lark-uid": "0",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-csrftoken": csrfToken,
                "x-request-id": requestId,
                "x-tt-trace-id": requestId
            },
            "referrer": window.location.href,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": JSON.stringify(requestData),
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });
        
        if (!resp.ok) {
            console.error(`[createExportTask] HTTP error! status: ${resp.status}`);
            throw new Error(`HTTP error! status: ${resp.status}`);
        }
        
        let json = await resp.json();
        console.log('[createExportTask] response:', json);
        const ticket = json?.data?.ticket || null;
        console.log(`[createExportTask] created task with ticket: ${ticket}`);
        return ticket;
    } catch (error) {
        console.error('[createExportTask] error:', error);
        throw error;
    }
}

// 下载文件（返回blob，不自动触发下载）
async function download(url, type) {
    console.log(`[download] downloading file from url: ${url}`);
    try {
        await sleep(500);
        const response = await fetch(url, {
            "headers": {},
            "referrer": window.location.href,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
        });
        
        if (!response.ok) {
            console.error(`[download] HTTP error! status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('[download] successfully downloaded file as blob:', blob);
        
        return blob;
    } catch (error) {
        console.error('[download] error:', error);
        throw error;
    }
}

// 等待导出结果
async function waitForExportResult(ticket, token, obj_type) {
    console.log(`[waitForExportResult] waiting for export result for ticket: ${ticket}`);
    
    // 参考代码在第一次请求前等待2秒
    await sleep(2000);
    
    let file_token;
    let resp;
    
    for (let retryCount = 0; retryCount < 15 && !file_token; retryCount++) {
        console.log(`[waitForExportResult] retry count: ${retryCount}`);
        await sleep(1000);
        
        try {
            resp = await fetchExportResult(ticket, token, obj_type);
            file_token = resp?.data?.result?.file_token;
        } catch (error) {
            console.error(`[waitForExportResult] error on retry ${retryCount}:`, error);
        }
    }
    
    if (file_token) {
        const result = {
            url: `https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/all/${file_token}/?synced_block_host_token=${token}&synced_block_host_type=${getFileTypeByObjType(obj_type)}`,
            type: resp?.data?.result?.file_extension || getFileExtensionByObjType(obj_type)
        };
        console.log('[waitForExportResult] successfully got export result:', result);
        return result;
    }
    
    console.warn('[waitForExportResult] failed to get export result after multiple retries');
    return null;
}

// 获取我的空间文件列表
async function getJson(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('[getJson] error:', error);
        throw error;
    }
}

// 递归获取文件夹中的文件和子文件夹（返回树形结构）
async function getFileListFromFolder(obj_token, parentPath = '', parentToken = '') {
    const files = [];
    const folders = [];
    
    try {
        await sleep(300); // 避免请求过快
        const url = obj_token 
            ? `${window.location.origin}/space/api/explorer/v3/children/list/?asc=1&rank=5&token=${obj_token}`
            : `${window.location.origin}/space/api/explorer/v3/my_space/obj/`;
        
        const json = await getJson(url);
        
        if (json && json.data && json.data.node_list) {
            for (const nodeId of json.data.node_list) {
                const node = json.data.entities.nodes[nodeId];
                if (!node || !node.obj_token || !node.name) continue;
                
                if (node.type === 0) {
                    // 是文件夹，递归获取
                    const folderPath = parentPath ? `${parentPath}/${node.name}` : node.name;
                    const folderData = {
                        obj_token: node.obj_token,
                        name: node.name,
                        path: folderPath,
                        parentToken: parentToken || obj_token,
                        type: 'folder',
                        children: []
                    };
                    
                    const subResult = await getFileListFromFolder(node.obj_token, folderPath, node.obj_token);
                    folderData.children = [...subResult.folders, ...subResult.files];
                    folders.push(folderData);
                } else {
                    // 是文件
                    files.push({
                        obj_token: node.obj_token,
                        obj_type: node.type,
                        name: node.name,
                        url: node.url || '',
                        path: parentPath,
                        parentToken: parentToken || obj_token,
                        type: 'file',
                        sourceRoot: parentPath.startsWith('共享文件夹') ? 'shared' : 'my' // 标识文件来源
                    });
                }
            }
        }
    } catch (error) {
        console.error(`[getFileListFromFolder] 获取文件夹 ${obj_token} 的文件列表失败:`, error);
    }
    
    return { files, folders };
}

// 获取所有文件和文件夹（树形结构）
async function getAllFiles() {
    console.log('[getAllFiles] 开始获取所有文件和文件夹');
    
    const allFiles = [];
    const allFolders = [];
    
    try {
        // 1. 获取我的空间数据
        console.log('[getAllFiles] 开始加载我的空间数据...');
        try {
            // 获取我的空间文件夹列表
            await sleep(500);
            const myFoldersJson = await getJson(`${window.location.origin}/space/api/explorer/v3/my_space/folder/?asc=1&rank=5&length=50`);
            
            if (myFoldersJson && myFoldersJson.data && myFoldersJson.data.node_list) {
                for (const token of myFoldersJson.data.node_list) {
                    const folder = myFoldersJson.data.entities.nodes[token];
                    if (folder && folder.obj_token && folder.name) {
                        const folderData = {
                            obj_token: folder.obj_token,
                            name: folder.name,
                            path: `我的文件夹/${folder.name}`,
                            parentToken: 'virtual_my_files',
                            type: 'folder',
                            children: []
                        };
                        
                        const subResult = await getFileListFromFolder(folder.obj_token, `我的文件夹/${folder.name}`, folder.obj_token);
                        folderData.children = [...subResult.folders, ...subResult.files];
                        allFolders.push(folderData);
                        // 不在这里添加文件，因为文件已经在children中了
                    }
                }
            }
            
            // 获取我的空间根目录文件（只获取根目录下的直接文件，不递归）
            await sleep(300);
            const rootJson = await getJson(`${window.location.origin}/space/api/explorer/v3/my_space/obj/`);
            if (rootJson && rootJson.data && rootJson.data.node_list) {
                const rootFiles = [];
                for (const nodeId of rootJson.data.node_list) {
                    const node = rootJson.data.entities.nodes[nodeId];
                    if (node && node.type !== 0 && node.obj_token && node.name) {
                        // 只添加文件，不添加文件夹（type !== 0 表示是文件）
                        rootFiles.push({
                            obj_token: node.obj_token,
                            obj_type: node.type,
                            name: node.name,
                            url: node.url || '',
                            path: '我的文件夹',
                            parentToken: 'virtual_my_files',
                            type: 'file',
                            sourceRoot: 'my' // 标识文件来源
                        });
                    }
                }
                allFiles.push(...rootFiles);
            }
        } catch (error) {
            console.error('[getAllFiles] 加载我的空间数据时出错:', error);
        }
        
        // 2. 获取共享空间数据
        console.log('[getAllFiles] 开始加载共享空间数据...');
        try {
            await sleep(500);
            const shareFoldersJson = await getJson(`${window.location.origin}/space/api/explorer/v2/share/folder/list/?asc=0&rank=3&hidden=0&length=50`);
            
            if (shareFoldersJson && shareFoldersJson.data && shareFoldersJson.data.node_list) {
                for (const token of shareFoldersJson.data.node_list) {
                    const folder = shareFoldersJson.data.entities.nodes[token];
                    if (folder && folder.obj_token && folder.name) {
                        const folderData = {
                            obj_token: folder.obj_token,
                            name: folder.name,
                            path: `共享文件夹/${folder.name}`,
                            parentToken: 'virtual_shared_files',
                            type: 'folder',
                            children: []
                        };
                        
                        const subResult = await getFileListFromFolder(folder.obj_token, `共享文件夹/${folder.name}`, folder.obj_token);
                        folderData.children = [...subResult.folders, ...subResult.files];
                        allFolders.push(folderData);
                        // 不在这里添加文件，因为文件已经在children中了
                    }
                }
            }
        } catch (error) {
            console.error('[getAllFiles] 加载共享空间数据时出错:', error);
        }
        
        // 构建树形结构
        const treeData = buildTreeStructure(allFiles, allFolders);
        
        console.log('[getAllFiles] 获取完成，文件:', allFiles.length, '个，文件夹:', allFolders.length, '个');
        return treeData;
    } catch (error) {
        console.error('[getAllFiles] 获取文件列表失败:', error);
        throw error;
    }
}

// 构建树形结构
function buildTreeStructure(files, folders) {
    const tree = [];
    const folderMap = new Map();
    const addedFiles = new Map(); // 改为Map，存储文件对象和来源信息
    
    // 创建根节点
    const myFilesRoot = {
        obj_token: 'virtual_my_files',
        name: '我的文件夹',
        type: 'folder',
        children: []
    };
    const sharedFilesRoot = {
        obj_token: 'virtual_shared_files',
        name: '共享文件夹',
        type: 'folder',
        children: []
    };
    
    tree.push(myFilesRoot);
    tree.push(sharedFilesRoot);
    
    // 将文件夹添加到映射（包括根节点）
    folderMap.set('virtual_my_files', myFilesRoot);
    folderMap.set('virtual_shared_files', sharedFilesRoot);
    folders.forEach(folder => {
        folderMap.set(folder.obj_token, folder);
    });
    
    // 处理文件夹层级关系
    folders.forEach(folder => {
        const parent = folderMap.get(folder.parentToken);
        if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(folder);
        } else {
            // 如果找不到父节点，添加到对应的根节点
            if (folder.parentToken === 'virtual_my_files') {
                myFilesRoot.children.push(folder);
            } else if (folder.parentToken === 'virtual_shared_files') {
                sharedFilesRoot.children.push(folder);
            }
        }
    });
    
    // 处理文件（智能去重：优先保留共享文件夹中的源文件）
    files.forEach(file => {
        const existingFile = addedFiles.get(file.obj_token);
        
        if (existingFile) {
            // 如果已存在，判断优先级
            const existingSource = existingFile.sourceRoot || 'my';
            const newSource = file.sourceRoot || 'my';
            
            // 优先保留共享文件夹中的文件（源文件）
            if (existingSource === 'my' && newSource === 'shared') {
                // 已存在的是我的文件夹中的（快捷方式），新的是共享文件夹中的（源文件）
                // 移除旧的，添加新的
                console.log(`[buildTreeStructure] 替换快捷方式为源文件: ${file.name} (${file.obj_token})`);
                
                // 从旧位置移除文件
                const oldParent = folderMap.get(existingFile.parentToken);
                if (oldParent && oldParent.children) {
                    const index = oldParent.children.findIndex(
                        child => child.type === 'file' && child.obj_token === file.obj_token
                    );
                    if (index !== -1) {
                        oldParent.children.splice(index, 1);
                    }
                }
                
                // 添加新文件
                addedFiles.set(file.obj_token, file);
                const parent = folderMap.get(file.parentToken);
                if (parent) {
                    if (!parent.children) parent.children = [];
                    parent.children.push(file);
                } else {
                    if (file.parentToken === 'virtual_my_files') {
                        myFilesRoot.children.push(file);
                    } else if (file.parentToken === 'virtual_shared_files') {
                        sharedFilesRoot.children.push(file);
                    }
                }
            } else {
                // 已存在的是共享文件夹中的（源文件），新的是我的文件夹中的（快捷方式），跳过新的
                console.log(`[buildTreeStructure] 跳过快捷方式，保留源文件: ${file.name} (${file.obj_token})`);
            }
            return;
        }
        
        // 新文件，直接添加
        addedFiles.set(file.obj_token, file);
        
        const parent = folderMap.get(file.parentToken);
        if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push(file);
        } else {
            // 如果找不到父节点，添加到对应的根节点
            if (file.parentToken === 'virtual_my_files') {
                myFilesRoot.children.push(file);
            } else if (file.parentToken === 'virtual_shared_files') {
                sharedFilesRoot.children.push(file);
            }
        }
    });
    
    // 递归去重文件夹中的文件（优先保留共享文件夹中的源文件）
    function deduplicateFolderChildren(folder) {
        if (!folder.children) return;
        
        const seen = new Map(); // 改为Map，存储文件对象
        folder.children = folder.children.filter(child => {
            if (child.type === 'file') {
                const existing = seen.get(child.obj_token);
                if (existing) {
                    // 已存在，判断优先级
                    const existingSource = existing.sourceRoot || 'my';
                    const newSource = child.sourceRoot || 'my';
                    
                    // 优先保留共享文件夹中的文件（源文件）
                    if (existingSource === 'my' && newSource === 'shared') {
                        // 移除旧的，保留新的
                        console.log(`[buildTreeStructure] 从文件夹 ${folder.name} 中替换快捷方式为源文件: ${child.name}`);
                        seen.set(child.obj_token, child);
                        return true; // 保留新的
                    } else {
                        // 保留旧的，移除新的
                        console.log(`[buildTreeStructure] 从文件夹 ${folder.name} 中移除重复文件: ${child.name}`);
                        return false; // 移除新的
                    }
                }
                seen.set(child.obj_token, child);
            } else if (child.type === 'folder') {
                deduplicateFolderChildren(child);
            }
            return true;
        });
    }
    
    // 对根节点进行去重
    deduplicateFolderChildren(myFilesRoot);
    deduplicateFolderChildren(sharedFilesRoot);
    
    return tree;
}

// 创建并注入UI面板到网页
function createPanel() {
    // 检查是否已经存在面板
    if (document.getElementById('feishu-download-panel')) {
        return document.getElementById('feishu-download-panel');
    }
    
    const panel = document.createElement('div');
    panel.id = 'feishu-download-panel';
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 450px;
        max-height: 90vh;
        z-index: 999999;
        background: white;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        display: none;
        flex-direction: column;
        overflow: hidden;
    `;
    
    // 创建标题栏（可拖拽）
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
    `;
    
    const title = document.createElement('h2');
    title.textContent = '飞书批量下载-青亿帆';
    title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    closeBtn.onclick = () => {
        panel.style.display = 'none';
    };
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // 创建内容容器
    const container = document.createElement('div');
    container.className = 'container';
    container.style.cssText = `
        padding: 24px;
        overflow-y: auto;
        max-height: calc(90vh - 60px);
    `;
    
    // 从popup.html复制结构
    container.innerHTML = `
        <button id="loadFilesBtn" class="btn-primary">获取所有文件</button>
        <button id="downloadBtn" class="btn-secondary" style="display: none; margin-top: 8px;">下载选中文件</button>
        
        <div id="fileListContainer" style="display: none; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-weight: 600;">文件列表 (<span id="fileCount">0</span> 个文件)</span>
                <div>
                    <button id="selectAllBtn" class="btn-link" style="font-size: 12px; padding: 4px 8px;">全选</button>
                    <button id="selectNoneBtn" class="btn-link" style="font-size: 12px; padding: 4px 8px;">全不选</button>
                </div>
            </div>
            <div id="fileList" class="file-list"></div>
        </div>
        
        <div id="error" class="error-container" style="display: none;">
            <h3>错误信息:</h3>
            <div id="errorContent" class="error-content"></div>
        </div>
        
        <div id="loading" class="loading" style="display: none;">
            <div class="spinner"></div>
            <span id="loadingText">正在处理...</span>
        </div>
        
        <div id="result" class="result-container" style="display: none;">
            <h3>结果:</h3>
            <div id="resultContent" class="result-content"></div>
        </div>
    `;
    
    panel.appendChild(header);
    panel.appendChild(container);
    document.body.appendChild(panel);
    
    // 实现拖拽功能
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
        if (e.target === closeBtn) return;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        
        if (e.target === header || header.contains(e.target)) {
            isDragging = true;
        }
    }
    
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            xOffset = currentX;
            yOffset = currentY;
            
            panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    }
    
    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }
    
    return panel;
}

// 显示/隐藏面板
function togglePanel() {
    const panel = document.getElementById('feishu-download-panel');
    if (!panel) {
        createPanel();
        const newPanel = document.getElementById('feishu-download-panel');
        newPanel.style.display = 'flex';
        // 触发panel.js初始化
        window.dispatchEvent(new Event('panelReady'));
    } else {
        if (panel.style.display === 'none' || !panel.style.display) {
            panel.style.display = 'flex';
        } else {
            panel.style.display = 'none';
        }
    }
}

// 监听来自panel.js的window事件
window.addEventListener('requestAllFiles', async function() {
    try {
        const tree = await getAllFiles();
        window.dispatchEvent(new CustomEvent('fileListReady', { 
            detail: { 
                tree: tree,
                success: true 
            } 
        }));
    } catch (error) {
        console.error('获取文件列表时发生错误:', error);
        window.dispatchEvent(new CustomEvent('fileListReady', { 
            detail: { 
                error: error.message || '获取文件列表失败',
                success: false 
            } 
        }));
    }
});

// 监听来自panel.js的下载请求
window.addEventListener('requestDownloadFile', async function(event) {
    const { requestId, obj_token, obj_type, fileName } = event.detail;
    
    try {
        const taskId = await createExportTask({
            token: obj_token,
            obj_type: obj_type
        });
        
        console.log(`下载文件: ${fileName}, 任务ID: ${taskId}`);
        
        if (taskId) {
            const result = await waitForExportResult(taskId, obj_token, obj_type);
            console.log(`获取导出结果成功:`, result);
            
            if (result && result.url) {
                // 下载文件并转换为base64 data URL
                try {
                    const blob = await download(result.url, result.type);
                    
                    // 将blob转换为base64 data URL
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = function() {
                            resolve(reader.result);
                        };
                        reader.onerror = function() {
                            reject(new Error('读取文件失败'));
                        };
                        reader.readAsDataURL(blob);
                    });
                    
                    window.dispatchEvent(new CustomEvent('fileDownloaded', {
                        detail: {
                            requestId: requestId,
                            response: {
                                success: true,
                                dataUrl: dataUrl,
                                fileName: fileName,
                                type: result.type
                            }
                        }
                    }));
                } catch (downloadError) {
                    console.error('下载文件时发生错误:', downloadError);
                    window.dispatchEvent(new CustomEvent('fileDownloaded', {
                        detail: {
                            requestId: requestId,
                            response: {
                                success: false,
                                error: '下载文件失败: ' + (downloadError.message || '未知错误')
                            }
                        }
                    }));
                }
            } else {
                window.dispatchEvent(new CustomEvent('fileDownloaded', {
                    detail: {
                        requestId: requestId,
                        response: {
                            success: false,
                            error: '获取导出结果失败，请稍后重试'
                        }
                    }
                }));
            }
        } else {
            window.dispatchEvent(new CustomEvent('fileDownloaded', {
                detail: {
                    requestId: requestId,
                    response: {
                        success: false,
                        error: '创建导出任务失败'
                    }
                }
            }));
        }
    } catch (error) {
        console.error('下载文件时发生错误:', error);
        window.dispatchEvent(new CustomEvent('fileDownloaded', {
            detail: {
                requestId: requestId,
                response: {
                    success: false,
                    error: error.message || '发生未知错误'
                }
            }
        }));
    }
});

// 监听来自background的消息（点击扩展图标时）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'togglePanel') {
        togglePanel();
        sendResponse({ success: true });
        return true;
    }
    
    // 原有的消息处理逻辑（保留以兼容其他可能的调用）
    if (request.action === 'getAllFiles') {
        (async () => {
            try {
                const tree = await getAllFiles();
                sendResponse({
                    success: true,
                    tree: tree
                });
            } catch (error) {
                console.error('获取文件列表时发生错误:', error);
                sendResponse({
                    success: false,
                    error: error.message || '获取文件列表失败'
                });
            }
        })();
        
        return true; // 保持消息通道开放以支持异步响应
    }
    
    if (request.action === 'downloadFile') {
        (async () => {
            try {
                const taskId = await createExportTask({
                    token: request.obj_token,
                    obj_type: request.obj_type
                });
                
                console.log(`下载文件: ${request.fileName}, 任务ID: ${taskId}`);
                
                if (taskId) {
                    const result = await waitForExportResult(taskId, request.obj_token, request.obj_type);
                    console.log(`获取导出结果成功:`, result);
                    
                    if (result && result.url) {
                        // 下载文件并转换为base64 data URL
                        try {
                            const blob = await download(result.url, result.type);
                            
                            // 将blob转换为base64 data URL（使用Promise包装）
                            const dataUrl = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = function() {
                                    resolve(reader.result);
                                };
                                reader.onerror = function() {
                                    reject(new Error('读取文件失败'));
                                };
                                reader.readAsDataURL(blob);
                            });
                            
                            sendResponse({
                                success: true,
                                dataUrl: dataUrl,
                                fileName: request.fileName,
                                type: result.type
                            });
                        } catch (downloadError) {
                            console.error('下载文件时发生错误:', downloadError);
                            sendResponse({
                                success: false,
                                error: '下载文件失败: ' + (downloadError.message || '未知错误')
                            });
                        }
                    } else {
                        sendResponse({
                            success: false,
                            error: '获取导出结果失败，请稍后重试'
                        });
                    }
                } else {
                    sendResponse({
                        success: false,
                        error: '创建导出任务失败'
                    });
                }
            } catch (error) {
                console.error('下载文件时发生错误:', error);
                sendResponse({
                    success: false,
                    error: error.message || '发生未知错误'
                });
            }
        })();
        
        return true; // 保持消息通道开放以支持异步响应
    }
    
    if (request.action === 'getDownloadLink') {
        (async () => {
            try {
                const taskId = await createExportTask({
                    token: request.obj_token,
                    obj_type: request.obj_type
                });
                
                console.log(`创建导出任务成功，任务ID: ${taskId}`);
                
                if (taskId) {
                    const result = await waitForExportResult(taskId, request.obj_token, request.obj_type);
                    console.log(`获取导出结果成功:`, result);
                    
                    if (result && result.url) {
                        // 直接触发下载
                        try {
                            await download(result.url, result.type);
                            sendResponse({
                                success: true,
                                message: '文件下载已开始',
                                type: result.type
                            });
                        } catch (downloadError) {
                            console.error('下载文件时发生错误:', downloadError);
                            sendResponse({
                                success: false,
                                error: '下载文件失败: ' + (downloadError.message || '未知错误')
                            });
                        }
                    } else {
                        sendResponse({
                            success: false,
                            error: '获取导出结果失败，请稍后重试'
                        });
                    }
                } else {
                    sendResponse({
                        success: false,
                        error: '创建导出任务失败'
                    });
                }
            } catch (error) {
                console.error('获取下载链接时发生错误:', error);
                sendResponse({
                    success: false,
                    error: error.message || '发生未知错误'
                });
            }
        })();
        
        return true; // 保持消息通道开放以支持异步响应
    }
});

