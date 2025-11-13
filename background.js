/**
 * Background Script - 处理扩展的后台任务
 */

// 获取指定URL的Cookie
async function getCookies(fieldName, url) {
    console.log(`[background.js] Getting cookie '${fieldName}' for URL '${url}'`);
    return new Promise((resolve, reject) => {
        chrome.cookies.get({ name: fieldName, url: url }, (cookie) => {
            if (chrome.runtime.lastError) {
                console.error('[background.js] getCookies error:', chrome.runtime.lastError);
                return reject(chrome.runtime.lastError);
            }
            const fieldValue = cookie ? cookie.value : null;
            console.log(`[background.js] Got cookie value: ${fieldValue}`);
            resolve(fieldValue);
        });
    });
}

// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
    console.log('[background.js] Extension icon clicked on tab:', tab.id);
    
    // 检查是否是飞书页面
    if (tab.url && (tab.url.includes('feishu.cn') || tab.url.includes('larkoffice.com'))) {
        // 发送消息到content script显示/隐藏面板
        chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[background.js] Error sending message:', chrome.runtime.lastError);
            }
        });
    } else {
        console.log('[background.js] Not a Feishu page, ignoring click');
    }
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[background.js] Received message:', msg);
    
    // 处理来自panel.js的消息（需要转发到content.js）
    if (msg.action === 'getAllFiles' || msg.action === 'downloadFile') {
        // 转发消息到content script
        if (sender.tab && sender.tab.id) {
            chrome.tabs.sendMessage(sender.tab.id, msg, (response) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse(response);
                }
            });
            return true; // 保持消息通道开放
        } else {
            sendResponse({ success: false, error: 'No tab ID available' });
            return false;
        }
    }
    
    switch (msg.type) {
        case 'getCookies':
            if (!msg.fieldName || !msg.url) {
                console.error('[background.js] Invalid getCookies message:', msg);
                sendResponse({ error: 'Invalid parameters for getCookies' });
                return false;
            }
            
            getCookies(msg.fieldName, msg.url).then((content) => {
                console.log(`[background.js] Sending cookie response for ${msg.fieldName}:`, content);
                sendResponse({ fieldValue: content });
            }).catch(error => {
                console.error('[background.js] Error getting cookies:', error);
                sendResponse({ error: error.message });
            });
            return true; // 异步返回响应
            
        default:
            console.warn('[background.js] Unknown message type:', msg.type);
            sendResponse({ error: `Unknown message type: ${msg.type}` });
            return false;
    }
});

