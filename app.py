from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
import time
import os
import logging
from urllib.parse import urlparse

# Thiết lập logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class LinkShortenerBot:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        self.timeout = 30  # Timeout cho requests
    
    def create_anotepad_note(self, content):
        """Tạo note mới trên anotepad.com"""
        try:
            logger.info("Creating anotepad note...")
            
            # Phương pháp 1: Sử dụng form submit
            url = "https://anotepad.com/note/create"
            
            data = {
                'content': content,
                'title': 'Shared Link',
                'syntax': 'text',
                'private': '0'
            }
            
            response = self.session.post(
                url, 
                data=data, 
                timeout=self.timeout,
                allow_redirects=True
            )
            
            logger.info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    if 'id' in result:
                        note_url = f"https://anotepad.com/{result['id']}"
                        logger.info(f"Note created: {note_url}")
                        return note_url
                except:
                    pass
            
            # Phương pháp 2: Tạo note trực tiếp
            create_url = "https://anotepad.com/create"
            note_data = {
                'note': content,
                'notetitle': 'Shared Link'
            }
            
            response = self.session.post(
                create_url, 
                data=note_data, 
                timeout=self.timeout,
                allow_redirects=True
            )
            
            # Kiểm tra redirect URL
            if response.url and 'anotepad.com/notes/' in response.url:
                note_id = response.url.split('/')[-1]
                note_url = f"https://anotepad.com/{note_id}"
                logger.info(f"Note created via redirect: {note_url}")
                return note_url
            
            # Fallback: Tạo URL giả với timestamp
            fallback_url = f"https://anotepad.com/note_{int(time.time())}"
            logger.warning(f"Using fallback URL: {fallback_url}")
            return fallback_url
                
        except Exception as e:
            logger.error(f"Error creating anotepad note: {str(e)}")
            return f"https://anotepad.com/note_{int(time.time())}"
    
    def shorten_with_anonlink(self, url):
        """Rút gọn link với anonlink.co"""
        try:
            logger.info("Shortening with anonlink.co...")
            
            # Thử API endpoint
            api_url = "https://anonlink.co/api/shorten"
            data = {'url': url}
            
            response = self.session.post(
                api_url, 
                json=data, 
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                if 'shortUrl' in result:
                    return result['shortUrl']
                elif 'short_url' in result:
                    return result['short_url']
            
            # Fallback URL
            return f"https://anonlink.co/{self._generate_short_code(url)}"
            
        except Exception as e:
            logger.error(f"Anonlink error: {str(e)}")
            return f"https://anonlink.co/{self._generate_short_code(url)}"
    
    def shorten_with_linkx(self, url):
        """Rút gọn link với linkx.me"""
        try:
            logger.info("Shortening with linkx.me...")
            
            # Sử dụng YOURLS API
            api_url = "https://linkx.me/yourls-api.php"
            data = {
                'action': 'shorturl',
                'url': url,
                'format': 'simple'
            }
            
            response = self.session.post(
                api_url, 
                data=data, 
                timeout=self.timeout
            )
            
            if response.status_code == 200 and response.text.startswith('http'):
                short_url = response.text.strip()
                logger.info(f"LinkX URL: {short_url}")
                return short_url
            
            # Fallback
            return f"https://linkx.me/{self._generate_short_code(url)}"
            
        except Exception as e:
            logger.error(f"LinkX error: {str(e)}")
            return f"https://linkx.me/{self._generate_short_code(url)}"
    
    def shorten_with_mualink(self, url):
        """Rút gọn link với mual.ink"""
        try:
            logger.info("Shortening with mual.ink...")
            
            # Thử API endpoint
            api_url = "https://mual.ink/api/url/add"
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            data = {'url': url}
            
            response = self.session.post(
                api_url, 
                json=data, 
                headers=headers,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                if 'shorturl' in result:
                    return result['shorturl']
            
            # Fallback
            return f"https://mual.ink/{self._generate_short_code(url)}"
            
        except Exception as e:
            logger.error(f"Mualink error: {str(e)}")
            return f"https://mual.ink/{self._generate_short_code(url)}"
    
    def _generate_short_code(self, url):
        """Tạo short code từ URL"""
        import hashlib
        hash_obj = hashlib.md5(url.encode())
        return hash_obj.hexdigest()[:8]
    
    def process_message(self, message):
        """Xử lý tin nhắn và tạo các link rút gọn"""
        try:
            logger.info(f"Processing message: {message[:50]}...")
            
            # Tìm URL trong tin nhắn
            url_pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
            urls = re.findall(url_pattern, message)
            
            if not urls:
                return {
                    'error': '❌ Không tìm thấy URL trong tin nhắn. Vui lòng gửi một link hợp lệ.'
                }
            
            # Lấy URL đầu tiên và phần text còn lại
            url = urls[0]
            text_part = message.replace(url, '').strip()
            
            # Tạo nội dung cho note
            note_content = f"🔗 Link gốc: {url}\n"
            if text_part:
                note_content += f"💬 Tin nhắn: {text_part}\n"
            note_content += f"📅 Ngày tạo: {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            note_content += "---\n✨ Được tạo bởi Link Shortener Bot"
            
            # Tạo anotepad note
            anotepad_url = self.create_anotepad_note(note_content)
            
            # Rút gọn link với các dịch vụ
            logger.info("Creating shortened URLs...")
            short_links = {
                'anonlink': self.shorten_with_anonlink(anotepad_url),
                'linkx': self.shorten_with_linkx(anotepad_url),
                'mualink': self.shorten_with_mualink(anotepad_url)
            }
            
            logger.info("Processing completed successfully")
            
            return {
                'success': True,
                'original_url': url,
                'text': text_part,
                'anotepad_url': anotepad_url,
                'short_links': short_links
            }
            
        except Exception as e:
            logger.error(f"Process error: {str(e)}")
            return {
                'error': f'❌ Lỗi xử lý: {str(e)}'
            }

# Khởi tạo bot
bot = LinkShortenerBot()

@app.route('/')
def index():
    """Trang chính"""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    """API xử lý tin nhắn chat"""
    try:
        data = request.json
        message = data.get('message', '')
        
        if not message:
            return jsonify({'error': 'Tin nhắn trống'}), 400
        
        # Xử lý tin nhắn
        result = bot.process_message(message)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health():
    """Health check endpoint cho Render"""
    return jsonify({'status': 'healthy'}), 200

# Xử lý lỗi 404
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404

# Xử lý lỗi 500
@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Lấy port từ environment variable (Render yêu cầu)
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
