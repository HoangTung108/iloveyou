// ========================================================
// 1. CẤU HÌNH NHẠC NỀN YOUTUBE (BẠN CÓ THỂ ĐỔI TẠI ĐÂY)
// ========================================================
// Chỉ cần thay mã Video ID YouTube (11 ký tự) hoặc dán link trong giao diện web
const DEFAULT_YOUTUBE_ID = 's3R7_qjGj80'; // Hoàng Dũng - Đôi Mươi (Official Audio)
const DEFAULT_SONG_TITLE = 'Đôi Mươi - Hoàng Dũng';

// ========================================================
// 2. KHỞI TẠO BIẾN & THAM CHIẾU DOM
// ========================================================
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('button');
const loadingContainer = document.getElementById('loading-container');
const progressBar = document.getElementById('progress');
const loadingPct = document.getElementById('loading-pct');

const fullPage = document.getElementById('fullPage');
const car = document.getElementById('car');
const merrywrap = document.getElementById('merrywrap');
const giftbox = document.getElementById('giftbox') || (merrywrap ? (merrywrap.querySelector('.new-giftbox') || merrywrap.querySelector('.giftbox')) : null);

const letterPaper = document.getElementById('letter-paper');
const letterCloseBtn = document.getElementById('letter-toggle-btn');
const minimizeLetterBtn = document.getElementById('minimize-letter-btn');
const reopenLetterBtn = document.getElementById('reopen-letter-btn');
const sendHeartsBtn = document.getElementById('send-hearts-btn');

// Trình điều khiển nhạc
const musicController = document.getElementById('music-controller');
const vinylDisc = document.getElementById('vinyl-disc');
const musicTitle = document.getElementById('music-title');
const musicPlayToggle = document.getElementById('music-play-toggle');
const playIcon = document.getElementById('play-icon');
const changeMusicBtn = document.getElementById('change-music-btn');

// Modal đổi nhạc
const musicModal = document.getElementById('music-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalApplyBtn = document.getElementById('modal-apply-btn');
const ytUrlInput = document.getElementById('yt-url-input');
const trackChips = document.querySelectorAll('.track-chip');

// Audio Fallback (file MP3)
const audioFallback = document.getElementById('audio');

let ytPlayer = null;
let isYtReady = false;
let isPlaying = false;
let currentSource = 'YOUTUBE'; // 'YOUTUBE' hoặc 'LOCAL'
let activeVideoId = localStorage.getItem('love_bgm_yt_id') || DEFAULT_YOUTUBE_ID;
let activeSongTitle = localStorage.getItem('love_bgm_title') || DEFAULT_SONG_TITLE;

if (activeVideoId === 'LOCAL') {
    currentSource = 'LOCAL';
}

// Cập nhật tên bài hát hiển thị
if (musicTitle) {
    musicTitle.textContent = activeSongTitle;
}

// ========================================================
// 3. TÍCH HỢP YOUTUBE IFRAME PLAYER API (AUDIO-ONLY)
// ========================================================
// Tải script API của YouTube bất đồng bộ
(function loadYouTubeApi() {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);
})();

// Hàm callback tự động được gọi khi YouTube API sẵn sàng
window.onYouTubeIframeAPIReady = function() {
    if (currentSource === 'LOCAL') return;
    initYouTubePlayer(activeVideoId);
};

function initYouTubePlayer(videoId) {
    try {
        ytPlayer = new YT.Player('yt-player-container', {
            height: '1',
            width: '1',
            videoId: videoId,
            playerVars: {
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                loop: 1,
                playlist: videoId, // Cần thiết để lặp lại bài hát trên YouTube
                modestbranding: 1,
                playsinline: 1
            },
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
                onError: onPlayerError
            }
        });
    } catch (e) {
        console.warn('Lỗi khởi tạo YouTube Player, chuyển sang nhạc MP3:', e);
        fallbackToLocalAudio();
    }
}

function onPlayerReady(event) {
    isYtReady = true;
    if (isPlaying && currentSource === 'YOUTUBE') {
        event.target.playVideo();
    }
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        setMusicUIPlaying(true);
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        if (event.data === YT.PlayerState.ENDED) {
            // Tự động lặp lại nếu hết bài
            if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo();
        } else {
            setMusicUIPlaying(false);
        }
    }
}

function onPlayerError(event) {
    console.warn('Lỗi phát YouTube (mã lỗi ' + event.data + '), chuyển sang nhạc MP3 dự phòng!');
    fallbackToLocalAudio();
}

function fallbackToLocalAudio() {
    currentSource = 'LOCAL';
    if (ytPlayer && ytPlayer.pauseVideo) {
        try { ytPlayer.pauseVideo(); } catch (e) {}
    }
    audioFallback.play().then(() => {
        setMusicUIPlaying(true);
        musicTitle.textContent = 'Đôi Mươi (MP3)';
    }).catch(e => {
        console.log('Chờ tương tác người dùng để phát âm thanh:', e);
    });
}

// Bật / Dừng nhạc
function playMusic() {
    isPlaying = true;
    if (currentSource === 'YOUTUBE' && ytPlayer && isYtReady && ytPlayer.playVideo) {
        try {
            ytPlayer.playVideo();
            setMusicUIPlaying(true);
        } catch (e) {
            fallbackToLocalAudio();
        }
    } else {
        audioFallback.play().then(() => {
            setMusicUIPlaying(true);
        }).catch(() => {});
    }
}

function pauseMusic() {
    isPlaying = false;
    if (currentSource === 'YOUTUBE' && ytPlayer && ytPlayer.pauseVideo) {
        try { ytPlayer.pauseVideo(); } catch (e) {}
    }
    if (audioFallback) {
        audioFallback.pause();
    }
    setMusicUIPlaying(false);
}

function toggleMusic() {
    if (isPlaying) {
        pauseMusic();
    } else {
        playMusic();
    }
}

function setMusicUIPlaying(playing) {
    isPlaying = playing;
    if (playing) {
        musicController.classList.add('playing');
        playIcon.textContent = '⏸️';
    } else {
        musicController.classList.remove('playing');
        playIcon.textContent = '▶️';
    }
}

// Trích xuất YouTube ID từ URL hoặc chuỗi ID
function extractYouTubeId(url) {
    if (!url) return null;
    url = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

// Thay đổi bài hát đang phát
function switchTrack(videoId, title) {
    activeVideoId = videoId;
    activeSongTitle = title || 'Nhạc Tình Yêu 💕';
    musicTitle.textContent = activeSongTitle;

    localStorage.setItem('love_bgm_yt_id', videoId);
    localStorage.setItem('love_bgm_title', activeSongTitle);

    if (videoId === 'LOCAL') {
        currentSource = 'LOCAL';
        if (ytPlayer && ytPlayer.pauseVideo) {
            try { ytPlayer.pauseVideo(); } catch (e) {}
        }
        audioFallback.currentTime = 0;
        audioFallback.play().then(() => setMusicUIPlaying(true)).catch(() => {});
    } else {
        currentSource = 'YOUTUBE';
        audioFallback.pause();
        if (ytPlayer && ytPlayer.loadVideoById) {
            ytPlayer.loadVideoById({
                videoId: videoId,
                startSeconds: 0
            });
            ytPlayer.playVideo();
            setMusicUIPlaying(true);
        } else {
            initYouTubePlayer(videoId);
            isPlaying = true;
        }
    }
}

// ========================================================
// 4. HIỆU ỨNG TIM BAY VÀ PHÁO HOA TÌNH YÊU TRÊN CANVAS
// ========================================================
const canvas = document.getElementById('heartCanvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class HeartParticle {
    constructor(x, y, isBurst = false) {
        this.x = x;
        this.y = y;
        this.isBurst = isBurst;
        
        if (isBurst) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed - 2;
            this.size = Math.random() * 18 + 10;
            this.life = 1;
            this.decay = Math.random() * 0.02 + 0.015;
            this.gravity = 0.12;
        } else {
            this.vx = (Math.random() - 0.5) * 1.5;
            this.vy = -(Math.random() * 2 + 1);
            this.size = Math.random() * 14 + 8;
            this.life = 1;
            this.decay = Math.random() * 0.008 + 0.004;
            this.gravity = 0;
        }
        
        const colors = ['#ff4081', '#ff1744', '#ff79b0', '#f50057', '#ff80ab', '#e91e63'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.rotation = Math.random() * Math.PI;
        this.vRot = (Math.random() - 0.5) * 0.05;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.rotation += this.vRot;
        this.life -= this.decay;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.size / 30, this.size / 30);
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        
        // Vẽ hình trái tim bằng Bezier Curve
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-15, -15, -25, 5, 0, 25);
        ctx.bezierCurveTo(25, 5, 15, -15, 0, 0);
        ctx.fill();
        ctx.restore();
    }
}

function spawnBurst(x, y, count = 18) {
    for (let i = 0; i < count; i++) {
        particles.push(new HeartParticle(x, y, true));
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Ngẫu nhiên thả tim từ đáy màn hình
    if (Math.random() < 0.08) {
        particles.push(new HeartParticle(Math.random() * canvas.width, canvas.height + 20, false));
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
    requestAnimationFrame(animateParticles);
}
animateParticles();

// Click bất kỳ đâu trên màn hình tạo tim bay
window.addEventListener('click', (e) => {
    // Không nổ tim nếu đang tương tác modal hoặc nút
    if (e.target.closest('#music-modal') || e.target.closest('#music-controller')) return;
    spawnBurst(e.clientX, e.clientY, 10);
});

// ========================================================
// 5. TIẾN TRÌNH BẮT ĐẦU & CHUYỂN CẢNH (START FLOW)
// ========================================================
let isStarted = false;

startBtn.addEventListener('click', () => {
    if (isStarted) return;
    isStarted = true;

    // Phát nhạc ngay khi có thao tác người dùng (đảm bảo autoplay trình duyệt chấp nhận)
    playMusic();

    startBtn.style.display = 'none';
    loadingContainer.classList.add('active');

    let percent = 0;
    const loadInterval = setInterval(() => {
        percent += 2;
        if (percent > 100) percent = 100;
        
        progressBar.style.width = percent + '%';
        loadingPct.textContent = percent + '%';

        if (percent >= 100) {
            clearInterval(loadInterval);
            setTimeout(revealMainStage, 400);
        }
    }, 35);
});

function revealMainStage() {
    startScreen.classList.add('hidden');
    fullPage.style.display = 'block';
    car.style.display = 'block';
    fullPage.classList.remove('night');

    // Bắt đầu chu kỳ ngày / đêm lãng mạn
    let time = 0;
    setInterval(() => {
        time++;
        if (time % 20 === 10) {
            fullPage.classList.add('night');
        } else if (time % 20 === 0) {
            fullPage.classList.remove('night');
        }
    }, 1000);
}

// ========================================================
// 6. TƯƠNG TÁC HỘP QUÀ & MỞ BỨC THƯ TÌNH
// ========================================================
let giftStep = 1;

if (giftbox) {
    giftbox.addEventListener('click', openGiftBox);
}

function openGiftBox() {
    if (giftStep === 1) {
        giftbox.removeEventListener('click', openGiftBox);
        merrywrap.className = 'merrywrap step-1';
        
        // Ẩn ngay lập tức huy hiệu mở quà
        const badge = document.getElementById('gift-badge') || (merrywrap ? merrywrap.querySelector('.gift-badge') : null);
        if (badge) {
            badge.style.display = 'none';
        }

        // Nổ tim tại vị trí hộp quà
        const rect = giftbox.getBoundingClientRect();
        spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 25);

        setTimeout(() => {
            merrywrap.className = 'merrywrap step-2';
            spawnBurst(rect.left + rect.width / 2, rect.top, 35);
            
            setTimeout(() => {
                merrywrap.className = 'merrywrap step-3';
                merrywrap.style.display = 'none'; // Ẩn hoàn toàn hộp quà khi thư đã mở
                showLetterPaper();
            }, 750);
        }, 550);
    }
}

function showLetterPaper() {
    letterPaper.classList.remove('minimized');
    letterPaper.classList.add('open');
    reopenLetterBtn.classList.remove('visible');

    // Nổ tim rực rỡ chúc mừng
    spawnBurst(window.innerWidth / 2, window.innerHeight / 2, 40);
}

function hideLetterPaper() {
    letterPaper.classList.add('minimized');
    setTimeout(() => {
        letterPaper.classList.remove('open');
        reopenLetterBtn.classList.add('visible');
    }, 400);
}

// Các nút tương tác trong bức thư
if (letterCloseBtn) letterCloseBtn.addEventListener('click', hideLetterPaper);
if (minimizeLetterBtn) minimizeLetterBtn.addEventListener('click', hideLetterPaper);
if (reopenLetterBtn) reopenLetterBtn.addEventListener('click', showLetterPaper);

if (sendHeartsBtn) {
    sendHeartsBtn.addEventListener('click', () => {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                spawnBurst(
                    Math.random() * (window.innerWidth * 0.6) + window.innerWidth * 0.2,
                    Math.random() * (window.innerHeight * 0.5) + window.innerHeight * 0.2,
                    20
                );
            }, i * 150);
        }
    });
}

// ========================================================
// 7. SỰ KIỆN TRÌNH ĐIỀU KHIỂN NHẠC & MODAL ĐỔI BÀI HÁT
// ========================================================
if (vinylDisc) vinylDisc.addEventListener('click', toggleMusic);
if (musicPlayToggle) musicPlayToggle.addEventListener('click', toggleMusic);

if (changeMusicBtn) {
    changeMusicBtn.addEventListener('click', () => {
        musicModal.classList.add('active');
        if (activeVideoId && activeVideoId !== 'LOCAL') {
            ytUrlInput.value = 'https://www.youtube.com/watch?v=' + activeVideoId;
        } else {
            ytUrlInput.value = '';
        }
        highlightActiveChip(activeVideoId);
    });
}

function highlightActiveChip(id) {
    trackChips.forEach(chip => {
        if (chip.getAttribute('data-id') === id) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

function closeModal() {
    musicModal.classList.remove('active');
}

if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);

// Đóng modal khi click ra ngoài vùng nội dung
if (musicModal) {
    musicModal.addEventListener('click', (e) => {
        if (e.target === musicModal) closeModal();
    });
}

// Click chọn một bài gợi ý
trackChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const id = chip.getAttribute('data-id');
        const title = chip.getAttribute('data-title');
        
        trackChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        if (id === 'LOCAL') {
            ytUrlInput.value = 'LOCAL';
        } else {
            ytUrlInput.value = 'https://www.youtube.com/watch?v=' + id;
        }
    });
});

// Nút Áp Dụng nhạc mới
if (modalApplyBtn) {
    modalApplyBtn.addEventListener('click', () => {
        const inputVal = ytUrlInput.value.trim();
        
        if (inputVal === 'LOCAL' || inputVal.toLowerCase().includes('doimuoi.mp3')) {
            switchTrack('LOCAL', 'Đôi Mươi (MP3)');
            closeModal();
            return;
        }

        const extractedId = extractYouTubeId(inputVal);
        if (!extractedId) {
            alert('Vui lòng nhập đường link YouTube hợp lệ hoặc chọn bài hát có sẵn nhé em!');
            return;
        }

        // Tìm tiêu đề nếu là bài gợi ý
        let chosenTitle = 'Nhạc YouTube 💕';
        trackChips.forEach(chip => {
            if (chip.getAttribute('data-id') === extractedId) {
                chosenTitle = chip.getAttribute('data-title');
            }
        });

        switchTrack(extractedId, chosenTitle);
        closeModal();
    });
}
