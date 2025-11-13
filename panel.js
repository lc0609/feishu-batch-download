// 检查库是否已加载
function checkLibrariesLoaded() {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip 库未加载');
    }
    if (typeof saveAs === 'undefined') {
        throw new Error('FileSaver 库未加载');
    }
}


// 等待库加载完成（库文件已经在manifest.json中自动加载）
function waitForLibraries(maxAttempts = 20) {
    // 由于库文件已经在manifest.json的content_scripts中声明，它们应该已经加载
    // 但为了安全起见，我们等待一小段时间确保它们完全初始化
    return new Promise((resolve) => {
        let attempts = 0;
        const check = () => {
            attempts++;
            try {
                checkLibrariesLoaded();
                console.log('库加载完成');
                resolve(true);
            } catch (error) {
                // 如果库还没加载，等待一下再试
                if (attempts < maxAttempts && (typeof JSZip === 'undefined' || typeof saveAs === 'undefined')) {
                    setTimeout(check, 100);
                } else {
                    console.error('库加载失败:', error);
                    console.log('JSZip 状态:', typeof JSZip);
                    console.log('saveAs 状态:', typeof saveAs);
                    resolve(false);
                }
            }
        };
        // 立即检查一次，如果失败则等待
        check();
    });
}

// 等待面板元素创建完成
function waitForPanel() {
    return new Promise((resolve) => {
        const check = () => {
            const panel = document.getElementById('feishu-download-panel');
            const loadFilesBtn = document.getElementById('loadFilesBtn');
            if (panel && loadFilesBtn) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// 初始化应用
async function initializeApp() {
    // 等待面板创建
    await waitForPanel();
    
    // 等待库加载（最多等待2秒）
    const libsLoaded = await Promise.race([
        waitForLibraries(),
        new Promise((resolve) => setTimeout(() => resolve(false), 2000))
    ]);
    
    if (!libsLoaded) {
        const errorContainer = document.getElementById('error');
        const errorContent = document.getElementById('errorContent');
        if (errorContainer && errorContent) {
            errorContainer.style.display = 'block';
            errorContent.textContent = 'JSZip 或 FileSaver 库加载失败。请确保 jszip.min.js 和 FileSaver.min.js 文件存在于扩展目录中，并且已刷新扩展。';
        }
        return;
    }
    
    console.log('面板初始化完成');
    
    const loadFilesBtn = document.getElementById('loadFilesBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const selectNoneBtn = document.getElementById('selectNoneBtn');
    const fileListContainer = document.getElementById('fileListContainer');
    const fileList = document.getElementById('fileList');
    const fileCount = document.getElementById('fileCount');
    const errorContainer = document.getElementById('error');
    const errorContent = document.getElementById('errorContent');
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    const resultContainer = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');
    
    let treeData = [];
    let allFilesFlat = []; // 扁平化的所有文件列表，用于下载
    let selectedFiles = new Set();

    // 从树形结构中收集所有文件（扁平化，去重）
    function collectAllFiles(nodes, fileList = [], seenTokens = new Set()) {
        nodes.forEach(node => {
            if (node.type === 'file') {
                // 去重：只添加未添加过的文件
                if (!seenTokens.has(node.obj_token)) {
                    fileList.push(node);
                    seenTokens.add(node.obj_token);
                } else {
                    console.warn(`[collectAllFiles] 跳过重复文件: ${node.name} (${node.obj_token})`);
                }
            } else if (node.type === 'folder' && node.children) {
                collectAllFiles(node.children, fileList, seenTokens);
            }
        });
        return fileList;
    }

    function hideResults() {
        resultContainer.style.display = 'none';
        errorContainer.style.display = 'none';
        loading.style.display = 'none';
    }

    function showLoading(text = '正在处理...') {
        hideResults();
        loading.style.display = 'block';
        loadingText.textContent = text;
        loadFilesBtn.disabled = true;
        downloadBtn.disabled = true;
    }

    function showError(error) {
        hideResults();
        loading.style.display = 'none';
        errorContainer.style.display = 'block';
        errorContent.textContent = error;
        loadFilesBtn.disabled = false;
        downloadBtn.disabled = false;
    }

    function showResult(content) {
        hideResults();
        loading.style.display = 'none';
        resultContainer.style.display = 'block';
        resultContent.innerHTML = content;
        loadFilesBtn.disabled = false;
        downloadBtn.disabled = false;
    }

    // 渲染树形结构
    function renderFileList(tree) {
        treeData = tree;
        allFilesFlat = collectAllFiles(tree);
        fileList.innerHTML = '';
        
        // 递归渲染节点
        function renderNode(node, level = 0, container) {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.style.paddingLeft = `${level * 20 + 8}px`;
            
            if (node.type === 'folder') {
                // 文件夹
                const folderContainer = document.createElement('div');
                folderContainer.className = 'folder-container';
                folderContainer.dataset.folderToken = node.obj_token;
                
                const hasChildren = node.children && node.children.length > 0;
                
                // 展开/收起图标（只有有子节点才显示）
                if (hasChildren) {
                    const expandIcon = document.createElement('span');
                    expandIcon.className = 'expand-icon';
                    expandIcon.textContent = '▶';
                    expandIcon.style.marginRight = '4px';
                    expandIcon.style.cursor = 'pointer';
                    expandIcon.style.fontSize = '10px';
                    expandIcon.style.color = '#666';
                    item.appendChild(expandIcon);
                } else {
                    // 空文件夹，显示占位符
                    const spacer = document.createElement('span');
                    spacer.style.marginRight = '4px';
                    spacer.style.width = '12px';
                    spacer.style.display = 'inline-block';
                    item.appendChild(spacer);
                }
                
                // 文件夹图标
                const folderIcon = document.createElement('span');
                folderIcon.textContent = '📁';
                folderIcon.style.marginRight = '8px';
                
                // 文件夹名称
                const folderName = document.createElement('span');
                folderName.textContent = node.name;
                folderName.style.fontWeight = '600';
                folderName.style.color = '#667eea';
                if (hasChildren) {
                    folderName.style.cursor = 'pointer';
                }
                
                item.appendChild(folderIcon);
                item.appendChild(folderName);
                
                // 子节点容器（默认隐藏）
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'folder-children';
                childrenContainer.style.display = 'none';
                childrenContainer.dataset.parentToken = node.obj_token;
                
                // 点击文件夹展开/收起（只有有子节点才能点击）
                if (hasChildren) {
                    const toggleFolder = (e) => {
                        if (e) {
                            e.stopPropagation();
                        }
                        const isExpanded = childrenContainer.style.display !== 'none';
                        if (isExpanded) {
                            childrenContainer.style.display = 'none';
                            const icon = item.querySelector('.expand-icon');
                            if (icon) icon.textContent = '▶';
                        } else {
                            childrenContainer.style.display = 'block';
                            const icon = item.querySelector('.expand-icon');
                            if (icon) icon.textContent = '▼';
                        }
                    };
                    
                    // 整行都可以点击（除了复选框）
                    item.addEventListener('click', (e) => {
                        // 如果点击的是复选框或其他交互元素，不触发展开/收起
                        if (e.target.type === 'checkbox' || e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') {
                            return;
                        }
                        toggleFolder(e);
                    });
                    item.style.cursor = 'pointer';
                    item.style.userSelect = 'none';
                }
                
                folderContainer.appendChild(item);
                
                // 如果有子节点，递归渲染
                if (node.children && node.children.length > 0) {
                    node.children.forEach(child => {
                        renderNode(child, level + 1, childrenContainer);
                    });
                    folderContainer.appendChild(childrenContainer);
                }
                
                if (container) {
                    container.appendChild(folderContainer);
                } else {
                    fileList.appendChild(folderContainer);
                }
            } else {
                // 文件
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `file-${node.obj_token}`;
                checkbox.value = node.obj_token;
                
                checkbox.addEventListener('change', function() {
                    if (this.checked) {
                        selectedFiles.add(node.obj_token);
                    } else {
                        selectedFiles.delete(node.obj_token);
                    }
                    updateDownloadButton();
                });
                
                // 阻止复选框点击事件冒泡
                checkbox.addEventListener('click', function(e) {
                    e.stopPropagation();
                });
                
                const fileIcon = document.createElement('span');
                fileIcon.textContent = '📄';
                fileIcon.style.marginRight = '8px';
                
                const label = document.createElement('span'); // 改为span，不使用label标签
                label.className = 'file-item-label';
                label.textContent = node.name;
                label.style.cursor = 'pointer';
                
                const info = document.createElement('span');
                info.className = 'file-item-info';
                info.textContent = getFileTypeName(node.obj_type);
                
                item.appendChild(checkbox);
                item.appendChild(fileIcon);
                item.appendChild(label);
                item.appendChild(info);
                
                // 给整个文件项添加点击事件，点击整行切换复选框
                item.addEventListener('click', function(e) {
                    // 如果点击的是复选框本身，不处理（由复选框自己的事件处理）
                    if (e.target === checkbox || e.target.type === 'checkbox') {
                        return;
                    }
                    
                    // 阻止事件冒泡，避免触发页面其他行为
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 切换复选框状态
                    checkbox.checked = !checkbox.checked;
                    if (checkbox.checked) {
                        selectedFiles.add(node.obj_token);
                    } else {
                        selectedFiles.delete(node.obj_token);
                    }
                    updateDownloadButton();
                });
                
                // 设置文件项样式，使其看起来可点击
                item.style.cursor = 'pointer';
                
                if (container) {
                    container.appendChild(item);
                } else {
                    fileList.appendChild(item);
                }
            }
        }
        
        // 渲染所有根节点（从上往下）
        tree.forEach(rootNode => {
            renderNode(rootNode, 0, null);
        });
        
        fileCount.textContent = allFilesFlat.length;
        fileListContainer.style.display = 'block';
        downloadBtn.style.display = 'block';
        updateDownloadButton();
    }

    function getFileTypeName(objType) {
        const typeMap = {
            8: '多维表',
            3: '表格',
            30: '幻灯片',
            2: '文档',
            22: '文档',
            11: '思维笔记'
        };
        return typeMap[objType] || '未知';
    }

    function updateDownloadButton() {
        const count = selectedFiles.size;
        if (count > 0) {
            downloadBtn.textContent = `下载选中文件 (${count})`;
            downloadBtn.disabled = false;
        } else {
            downloadBtn.textContent = '下载选中文件';
            downloadBtn.disabled = true;
        }
    }

    // 获取所有文件
    loadFilesBtn.addEventListener('click', async function() {
        showLoading('正在获取文件列表...');

        try {
            // 通过window事件请求文件列表（content.js会监听）
            window.dispatchEvent(new CustomEvent('requestAllFiles'));
        } catch (error) {
            showError('发生错误: ' + error.message);
        }
    });
    
    // 监听文件列表就绪事件
    window.addEventListener('fileListReady', function(event) {
        const { tree, error } = event.detail;
        if (error) {
            showError(error);
        } else if (tree && tree.length > 0) {
            renderFileList(tree);
            hideResults();
        } else {
            showError('未找到文件，请确保您有访问权限');
        }
    });

    // 全选
    selectAllBtn.addEventListener('click', function() {
        const checkboxes = fileList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            selectedFiles.add(cb.value);
        });
        updateDownloadButton();
    });

    // 全不选
    selectNoneBtn.addEventListener('click', function() {
        const checkboxes = fileList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
        selectedFiles.clear();
        updateDownloadButton();
    });
    
    // 从树形结构中获取文件的完整路径
    function getFilePathFromTree(nodes, objToken, fileName, currentPath = '') {
        for (const node of nodes) {
            const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
            
            if (node.type === 'file' && node.obj_token === objToken) {
                // 找到文件，返回路径
                return nodePath.endsWith(fileName) ? nodePath : `${nodePath}/${fileName}`;
            } else if (node.type === 'folder' && node.children) {
                // 递归查找
                const found = getFilePathFromTree(node.children, objToken, fileName, nodePath);
                if (found) return found;
            }
        }
        return fileName; // 如果找不到，返回文件名
    }

    // 批量下载
    downloadBtn.addEventListener('click', async function() {
        // 再次检查库是否已加载
        try {
            checkLibrariesLoaded();
        } catch (error) {
            showError('JSZip 或 FileSaver 库未加载，请刷新页面重试');
            return;
        }
        
        if (selectedFiles.size === 0) {
            showError('请至少选择一个文件');
            return;
        }

        const filesToDownload = allFilesFlat.filter(file => selectedFiles.has(file.obj_token));
        console.log('[下载] 选中的文件数量:', selectedFiles.size);
        console.log('[下载] 所有文件数量:', allFilesFlat.length);
        console.log('[下载] 要下载的文件数量:', filesToDownload.length);
        console.log('[下载] 要下载的文件列表:', filesToDownload.map(f => f.name));
        console.log('[下载] 选中的obj_token:', Array.from(selectedFiles));
        
        if (filesToDownload.length !== selectedFiles.size) {
            console.warn('[下载] 警告：要下载的文件数量与选中的数量不一致！');
        }
        
        showLoading(`正在下载 ${filesToDownload.length} 个文件...`);

        try {
            const zip = new JSZip();
            let successCount = 0;
            let failCount = 0;

            // 批量下载文件（按顺序下载）
            for (let i = 0; i < filesToDownload.length; i++) {
                const file = filesToDownload[i];
                loadingText.textContent = `正在下载 ${i + 1}/${filesToDownload.length}: ${file.name}`;
                
                try {
                    // 等待下载完成（通过window事件）
                    const response = await new Promise((resolve) => {
                        const requestId = Math.random().toString(36).substring(2, 11);
                        
                        // 监听响应
                        const handler = (event) => {
                            if (event.detail.requestId === requestId) {
                                window.removeEventListener('fileDownloaded', handler);
                                resolve(event.detail.response);
                            }
                        };
                        window.addEventListener('fileDownloaded', handler);
                        
                        // 发送下载请求
                        window.dispatchEvent(new CustomEvent('requestDownloadFile', {
                            detail: {
                                requestId: requestId,
                                obj_token: file.obj_token,
                                obj_type: file.obj_type,
                                fileName: file.name
                            }
                        }));
                        
                        // 超时处理
                        setTimeout(() => {
                            window.removeEventListener('fileDownloaded', handler);
                            resolve({ success: false, error: '下载超时' });
                        }, 300000); // 5分钟超时
                    });
                    
                    if (response && response.success && response.dataUrl) {
                        // 从base64 data URL转换为ArrayBuffer
                        const base64Data = response.dataUrl.split(',')[1];
                        const binaryString = atob(base64Data);
                        const arrayBuffer = new Uint8Array(binaryString.length);
                        for (let j = 0; j < binaryString.length; j++) {
                            arrayBuffer[j] = binaryString.charCodeAt(j);
                        }
                        
                        const extension = getFileExtension(file.obj_type);
                        // 使用原始文件名，如果已经有扩展名就保留，否则添加扩展名
                        let fileName = file.name;
                        if (!fileName.includes('.')) {
                            fileName = `${fileName}.${extension}`;
                        }
                        
                        // 从树形结构中获取完整路径
                        const fullPath = getFilePathFromTree(treeData, file.obj_token, fileName);
                        
                        zip.file(fullPath, arrayBuffer);
                        successCount++;
                        console.log(`文件 ${fullPath} 已添加到压缩包`);
                    } else {
                        failCount++;
                        console.error(`下载文件失败: ${file.name}`, response?.error);
                    }
                } catch (error) {
                    failCount++;
                    console.error(`处理文件 ${file.name} 时出错:`, error);
                }
            }

            // 生成zip文件
            loadingText.textContent = '正在生成压缩包...';
            const content = await zip.generateAsync({ type: 'blob' });
            
            // 保存文件
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            saveAs(content, `飞书文件批量下载-${timestamp}.zip`);
            
            showResult(`
                <div style="text-align: center; padding: 10px;">
                    <div style="font-size: 48px; margin-bottom: 10px; color: #10b981;">✓</div>
                    <div style="color: #10b981; font-weight: 600; margin-bottom: 8px; font-size: 16px;">下载完成</div>
                    <div style="color: #666; font-size: 13px; margin-top: 5px;">
                        成功: ${successCount} 个<br>
                        ${failCount > 0 ? `失败: ${failCount} 个` : ''}
                    </div>
                </div>
            `);
        } catch (error) {
            showError('下载过程中发生错误: ' + error.message);
        }
    });

    function getFileExtension(objType) {
        const extMap = {
            8: 'xlsx',
            3: 'xlsx',
            30: 'pptx',
            2: 'docx',
            22: 'docx',
            11: 'mm'
        };
        return extMap[objType] || 'pdf';
    }
}

// 监听面板就绪事件或直接初始化
if (document.getElementById('feishu-download-panel')) {
    initializeApp();
} else {
    window.addEventListener('panelReady', initializeApp);
    // 如果面板已经存在，也尝试初始化
    setTimeout(() => {
        if (document.getElementById('feishu-download-panel')) {
            initializeApp();
        }
    }, 500);
}

