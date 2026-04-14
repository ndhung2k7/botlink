class ChatApp {
    constructor() {
        this.messagesContainer = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.charCount = document.getElementById('charCount');
        this.toast = document.getElementById('toast');
        this.toastMessage = document.getElementById('toastMessage');
        this.themeToggle = document.querySelector('.theme-toggle');
        
        this.messageHistory = [];
        this.isProcessing = false;
        this.currentTheme = 'light';
        
        this.init();
    }
    
    init() {
        // Event listeners
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyPress(e));
        this.messageInput.addEventListener('input', () => this.updateCharCount());
        
        // Clear chat
        document.querySelector('.clear-chat').addEventListener('click', () => this.clearChat());
        
        // Theme toggle
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // Focus input
        this.messageInput.focus();
        
        // Load theme preference
        this.loadTheme();
    }
    
    handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }
    
    updateCharCount() {
        const count = this.messageInput.value.length;
        this.charCount.textContent = count;
        
        if (count > 450) {
            this.charCount.style.color = 'var(--warning-color)';
        } else if (count > 500) {
            this.charCount.style.color = 'var(--danger-color)';
        } else {
            this.charCount.style.color = 'var(--text-secondary)';
        }
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message || this.isProcessing) return;
        
        if (message.length > 500) {
            this.showToast('Tin nhắn không được vượt quá 500 ký tự', 'error');
            return;
        }
        
        // Add user message
        this.addMessage(message, 'user');
        
        // Clear input
        this.messageInput.value = '';
        this.updateCharCount();
        
        // Show loading
        this.showLoading(true);
        this.isProcessing = true;
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });
            
            const data = await response.json();
            
            this.showLoading(false);
            
            if (data.error) {
                this.addMessage(data.error, 'bot', true);
            } else {
                this.addBotResponse(data);
            }
            
        } catch (error) {
            this.showLoading(false);
            this.addMessage('❌ Không thể kết nối đến server. Vui lòng thử lại sau.', 'bot', true);
            console.error('Error:', error);
        }
        
        this.isProcessing = false;
        this.messageInput.focus();
    }
    
    addMessage(text, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        if (isError) messageDiv.classList.add('error-message');
        
        // Avatar
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = sender === 'user' ? 
            '<i class="fas fa-user"></i>' : 
            '<i class="fas fa-robot"></i>';
        
        // Message wrapper
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'message-wrapper';
        
        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (sender === 'user') {
            contentDiv.textContent = text;
        } else {
            contentDiv.innerHTML = this.formatMessage(text);
        }
        
        // Time
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.getCurrentTime();
        
        wrapperDiv.appendChild(contentDiv);
        wrapperDiv.appendChild(timeDiv);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(wrapperDiv);
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Save to history
        this.messageHistory.push({
            text,
            sender,
            timestamp: new Date().toISOString()
        });
        
        // Save to localStorage
        this.saveHistory();
    }
    
    addBotResponse(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
        
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'message-wrapper';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        let html = `
            <p>✅ <strong>Đã xử lý thành công!</strong></p>
            <p>🔗 <strong>Link gốc:</strong><br>
            <a href="${data.original_url}" target="_blank" style="color: var(--primary-color);">${this.truncateUrl(data.original_url)}</a></p>
        `;
        
        if (data.text) {
            html += `<p>💬 <strong>Tin nhắn:</strong> ${this.escapeHtml(data.text)}</p>`;
        }
        
        html += `
            <p>📝 <strong>Anotepad Note:</strong><br>
            <a href="${data.anotepad_url}" target="_blank" style="color: var(--primary-color);">${this.truncateUrl(data.anotepad_url)}</a></p>
            
            <div class="links-container">
                <h4>🔗 Links rút gọn:</h4>
        `;
        
        // Add short links
        const services = {
            anonlink: { name: 'AnonLink.co', icon: '🔗' },
            linkx: { name: 'LinkX.me', icon: '⚡' },
            mualink: { name: 'Mual.ink', icon: '🎯' }
        };
        
        for (const [key, service] of Object.entries(services)) {
            if (data.short_links[key]) {
                html += this.createLinkItem(service.name, service.icon, data.short_links[key]);
            }
        }
        
        html += '</div>';
        
        contentDiv.innerHTML = html;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.getCurrentTime();
        
        wrapperDiv.appendChild(contentDiv);
        wrapperDiv.appendChild(timeDiv);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(wrapperDiv);
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Add copy handlers
        this.addCopyButtonHandlers();
    }
    
    createLinkItem(serviceName, icon, url) {
        return `
            <div class="link-item">
                <div class="link-header">
                    <span class="link-service">
                        <span>${icon}</span>
                        <span>${serviceName}</span>
                    </span>
                    <button class="copy-link-btn" data-url="${url}">
                        <i class="fas fa-copy"></i>
                        Copy
                    </button>
                </div>
                <a href="${url}" target="_blank" class="link-url">${url}</a>
            </div>
        `;
    }
    
    addCopyButtonHandlers() {
        const copyButtons = document.querySelectorAll('.copy-link-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const url = btn.dataset.url;
                await this.copyToClipboard(url);
                
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                btn.classList.add('copied');
                
                setTimeout(() => {
                    btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                    btn.classList.remove('copied');
                }, 2000);
            });
        });
    }
    
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('✅ Đã copy link vào clipboard!');
        } catch (err) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('✅ Đã copy link vào clipboard!');
        }
    }
    
    formatMessage(text) {
        text = this.escapeHtml(text);
        
        // URLs to links
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        text = text.replace(urlPattern, '<a href="$1" target="_blank" style="color: var(--primary-color);">$1</a>');
        
        // Line breaks
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    truncateUrl(url, maxLength = 50) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    }
    
    showLoading(show) {
        this.loadingIndicator.style.display = show ? 'block' : 'none';
        this.sendBtn.disabled = show;
        
        if (show) {
            this.scrollToBottom();
        }
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }
    
    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    clearChat() {
        if (confirm('Bạn có chắc muốn xóa lịch sử chat?')) {
            this.messagesContainer.innerHTML = `
                <div class="message bot-message">
                    <div class="message-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-wrapper">
                        <div class="message-content">
                            <p>👋 Xin chào! Tôi là <strong>Link Shortener Bot</strong>.</p>
                            <p>📌 <strong>Cách sử dụng:</strong></p>
                            <p>1️⃣ Gửi link và tin nhắn (tùy chọn)<br>
                            2️⃣ Tôi sẽ tạo note trên anotepad.com<br>
                            3️⃣ Rút gọn link qua 3 dịch vụ khác nhau</p>
                            <p>💡 <strong>Ví dụ:</strong><br>
                            <code>https://github.com/username/repo Đây là dự án của tôi</code></p>
                            <p>✨ Hãy thử gửi một link ngay bây giờ!</p>
                        </div>
                        <div class="message-time">${this.getCurrentTime()}</div>
                    </div>
                </div>
            `;
            this.messageHistory = [];
            localStorage.removeItem('chatHistory');
            this.showToast('Đã xóa lịch sử chat');
        }
    }
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', this.currentTheme);
        
        const icon = this.themeToggle.querySelector('i');
        icon.className = this.currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        
        localStorage.setItem('theme', this.currentTheme);
        this.showToast(`Đã chuyển sang theme ${this.currentTheme === 'light' ? 'sáng' : 'tối'}`);
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.currentTheme = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);
        
        if (this.themeToggle) {
            const icon = this.themeToggle.querySelector('i');
            icon.className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
    
    saveHistory() {
        try {
            localStorage.setItem('chatHistory', JSON.stringify(this.messageHistory.slice(-50)));
        } catch (e) {
            console.warn('Cannot save history:', e);
        }
    }
    
    showToast(message, type = 'success') {
        this.toastMessage.textContent = message;
        this.toast.classList.add('show');
        
        const icon = this.toast.querySelector('i');
        if (type === 'error') {
            icon.className = 'fas fa-exclamation-circle';
            this.toast.style.background = 'var(--danger-color)';
        } else {
            icon.className = 'fas fa-check-circle';
            this.toast.style.background = 'var(--text-primary)';
        }
        
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});
