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

// Search nhạc
const songSearchInput = document.getElementById('song-search-input');
const songSearchBtn = document.getElementById('song-search-btn');
const searchBtnIcon = document.getElementById('search-btn-icon');
const searchResultsBox = document.getElementById('search-results-box');
const searchResultsList = document.getElementById('search-results-list');

// Audio Fallback (file MP3) - dùng cho cả Piped stream lẫn file local
const audioFallback = document.getElementById('audio');

let ytPlayer = null;
let isYtReady = false;
let isPlaying = false;
let currentSource = 'PIPED'; // 'PIPED' | 'YOUTUBE' | 'LOCAL'
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
// 3. ENGINE NHẠC — PIPED AUDIO STREAM (KHÔNG QUẢNG CÁO)
//    Fallback → YouTube IFrame → MP3 local
// ========================================================

const PIPED_STREAM_APIS = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.adminforge.de',
];
const STREAM_TIMEOUT_MS = 8000;

// Lấy audio stream URL + title từ Piped (race song song tất cả instance)
function fetchPipedStream(videoId) {
    const controllers = [];

    const fetchers = PIPED_STREAM_APIS.map(base => {
        const ctrl = new AbortController();
        controllers.push(ctrl);
        const tid = setTimeout(() => ctrl.abort(), STREAM_TIMEOUT_MS);

        return fetch(`${base}/streams/${videoId}`, { signal: ctrl.signal })
            .then(r => { clearTimeout(tid); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(data => {
                clearTimeout(tid);
                const streams = (data.audioStreams || [])
                    .filter(s => s.url && s.mimeType && s.mimeType.startsWith('audio'))
                    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                if (!streams.length) throw new Error('no audio stream');
                // Lấy stream chất lượng cao nhưng không quá nặng (ưu 128k)
                const best = streams.find(s => (s.bitrate || 0) <= 160000) || streams[0];
                return {
                    streamUrl: best.url,
                    title: data.title || null,
                    mimeType: best.mimeType || 'audio/webm',
                };
            })
            .catch(e => { clearTimeout(tid); throw e; });
    });

    // Khi 1 cái thành công, hủy tất cả còn lại
    return Promise.any(fetchers).finally(() => {
        controllers.forEach(c => { try { c.abort(); } catch(_) {} });
    });
}

// Cập nhật title trên UI và lưu localStorage
function updateMusicTitle(title) {
    if (!title) return;
    activeSongTitle = title;
    if (musicTitle) musicTitle.textContent = title;
    localStorage.setItem('love_bgm_title', title);
}

// ── Phát qua Piped audio stream ──
async function playViaPiped(videoId, knownTitle) {
    if (knownTitle) updateMusicTitle(knownTitle);
    try {
        const result = await fetchPipedStream(videoId);

        // Cập nhật title thật từ API
        if (result.title) updateMusicTitle(result.title);
        localStorage.setItem('love_bgm_title', activeSongTitle);

        // Dừng YouTube IFrame nếu đang chạy
        if (ytPlayer && ytPlayer.pauseVideo) { try { ytPlayer.pauseVideo(); } catch(_) {} }

        // Set src và phát
        audioFallback.src = result.streamUrl;
        audioFallback.loop = true;
        audioFallback.load();
        await audioFallback.play();
        currentSource = 'PIPED';
        setMusicUIPlaying(true);
        return true;
    } catch (err) {
        if (err && err.name === 'AbortError') return false;
        console.warn('[Piped] Không lấy được stream, thử YouTube IFrame:', err);
        return false;
    }
}

// ── YouTube IFrame (fallback khi Piped thất bại) ──
// Tải script API của YouTube bất đồng bộ
(function loadYouTubeApi() {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);
})();

window.onYouTubeIframeAPIReady = function() {
    // Chỉ khởi tạo nếu Piped chưa chạy thành công
    if (currentSource !== 'PIPED' && activeVideoId !== 'LOCAL') {
        initYouTubePlayer(activeVideoId);
    }
};

function initYouTubePlayer(videoId, autoplayOnReady = false) {
    try {
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById({ videoId, startSeconds: 0 });
            if (autoplayOnReady) isPlaying = true;
            return;
        }
        ytPlayer = new YT.Player('yt-player-container', {
            height: '1', width: '1',
            videoId,
            playerVars: {
                autoplay: autoplayOnReady ? 1 : 0,
                controls: 0, disablekb: 1, fs: 0,
                loop: 1, playlist: videoId,
                modestbranding: 1, playsinline: 1,
                rel: 0, iv_load_policy: 3,
            },
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
                onError: onPlayerError,
            }
        });
    } catch (e) {
        console.warn('Lỗi YouTube Player, chuyển sang MP3:', e);
        fallbackToLocalAudio();
    }
}

function onPlayerReady(event) {
    isYtReady = true;
    event.target.setVolume(80);
    if (isPlaying && currentSource === 'YOUTUBE') {
        try { event.target.playVideo(); } catch(_) {}
    }
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.BUFFERING || event.data === YT.PlayerState.CUED) {
        if (isPlaying && currentSource === 'YOUTUBE') {
            try { event.target.playVideo(); } catch(_) {}
        }
        return;
    }
    if (event.data === YT.PlayerState.PLAYING) {
        setMusicUIPlaying(true);
    } else if (event.data === YT.PlayerState.PAUSED) {
        setMusicUIPlaying(false);
    } else if (event.data === YT.PlayerState.ENDED) {
        if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo();
    }
}

function onPlayerError(event) {
    console.warn('[YouTube IFrame] Lỗi ' + event.data + ', chuyển sang MP3 dự phòng!');
    fallbackToLocalAudio();
}

function fallbackToLocalAudio() {
    currentSource = 'LOCAL';
    if (ytPlayer && ytPlayer.pauseVideo) { try { ytPlayer.pauseVideo(); } catch(_) {} }
    // Khôi phục file MP3 gốc
    audioFallback.removeAttribute('src');
    const source = audioFallback.querySelector('source');
    if (source) source.src = 'doimuoi.mp3';
    audioFallback.load();
    audioFallback.play()
        .then(() => {
            setMusicUIPlaying(true);
            updateMusicTitle('Đôi Mươi - Hoàng Dũng');
        })
        .catch(e => console.log('Cần tương tác người dùng:', e));
}

// ── Điều khiển phát/dừng chung ──
function playMusic() {
    isPlaying = true;
    if (currentSource === 'YOUTUBE' && ytPlayer && isYtReady && ytPlayer.playVideo) {
        try { ytPlayer.playVideo(); setMusicUIPlaying(true); } catch(e) { fallbackToLocalAudio(); }
    } else {
        audioFallback.play().then(() => setMusicUIPlaying(true)).catch(() => {});
    }
}

function pauseMusic() {
    isPlaying = false;
    if (currentSource === 'YOUTUBE' && ytPlayer && ytPlayer.pauseVideo) {
        try { ytPlayer.pauseVideo(); } catch(_) {}
    }
    audioFallback.pause();
    setMusicUIPlaying(false);
}

function toggleMusic() {
    if (isPlaying) pauseMusic(); else playMusic();
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

// ── Switch track: Piped → YouTube IFrame → Local MP3 ──
async function switchTrack(videoId, title) {
    activeVideoId = videoId;
    // Hiển thị title đã biết ngay (sẽ cập nhật lại bằng title thật từ API)
    updateMusicTitle(title || 'Đang tải...');
    localStorage.setItem('love_bgm_yt_id', videoId);
    isPlaying = true;

    if (videoId === 'LOCAL') {
        currentSource = 'LOCAL';
        if (ytPlayer && ytPlayer.pauseVideo) { try { ytPlayer.pauseVideo(); } catch(_) {} }
        audioFallback.removeAttribute('src');
        const source = audioFallback.querySelector('source');
        if (source) source.src = 'doimuoi.mp3';
        audioFallback.load();
        audioFallback.currentTime = 0;
        audioFallback.play().then(() => {
            setMusicUIPlaying(true);
            updateMusicTitle('Đôi Mươi - Hoàng Dũng (MP3)');
        }).catch(() => {});
        return;
    }

    // Thử Piped stream trước
    const pipedOk = await playViaPiped(videoId, title);
    if (pipedOk) return;

    // Fallback: YouTube IFrame
    currentSource = 'YOUTUBE';
    audioFallback.pause();
    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
        try {
            ytPlayer.loadVideoById({ videoId, startSeconds: 0 });
            setMusicUIPlaying(true);
        } catch(e) {
            fallbackToLocalAudio();
        }
    } else {
        if (ytPlayer) { try { ytPlayer.destroy(); } catch(_) {} ytPlayer = null; }
        isYtReady = false;
        initYouTubePlayer(videoId, true);
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

    // Khởi động nhạc khi có tương tác người dùng
    if (activeVideoId === 'LOCAL') {
        playMusic();
    } else {
        // Thử Piped stream trước, không cần chờ — chạy nền
        isPlaying = true;
        playViaPiped(activeVideoId, activeSongTitle).then(ok => {
            if (!ok) playMusic(); // fallback YouTube IFrame / MP3
        });
    }

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
        // Tiêu đề từ kết quả search có thể được lưu trong dataset
        if (ytUrlInput.dataset.searchTitle) {
            chosenTitle = ytUrlInput.dataset.searchTitle;
            delete ytUrlInput.dataset.searchTitle;
        }

        switchTrack(extractedId, chosenTitle);
        closeModal();
    });
}

// ========================================================
// 8. SEARCH BÀI HÁT TRỰC TIẾP (PARALLEL RACE + CACHE)
// ========================================================

// Danh sách instance — sẽ race song song, lấy cái nào phản hồi trước
const SEARCH_INSTANCES = [
    { type: 'piped',     base: 'https://pipedapi.kavin.rocks' },
    { type: 'piped',     base: 'https://api.piped.projectsegfau.lt' },
    { type: 'piped',     base: 'https://pipedapi.tokhmi.xyz' },
    { type: 'piped',     base: 'https://pipedapi.adminforge.de' },
    { type: 'invidious', base: 'https://invidious.nerdvpn.de' },
    { type: 'invidious', base: 'https://yt.artemislena.eu' },
];

const SEARCH_TIMEOUT_MS = 6000;
const searchCache = new Map(); // query → items[]
let searchDebounceTimer = null;
let searchAbortCtrl = null;

function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ':' + String(s).padStart(2, '0');
}

function setSearchLoading(loading) {
    if (!searchBtnIcon) return;
    if (loading) {
        searchBtnIcon.innerHTML = '<div class="spinner"></div>';
        if (songSearchBtn) songSearchBtn.disabled = true;
    } else {
        searchBtnIcon.textContent = '🔍';
        if (songSearchBtn) songSearchBtn.disabled = false;
    }
}

function showSearchStatus(msg, isError = false) {
    if (!searchResultsList || !searchResultsBox) return;
    searchResultsBox.classList.remove('hidden');
    searchResultsList.innerHTML = `<div class="search-status ${isError ? 'error' : ''}">${msg}</div>`;
}

function showSearchSkeleton() {
    if (!searchResultsList || !searchResultsBox) return;
    searchResultsBox.classList.remove('hidden');
    let html = '';
    for (let i = 0; i < 5; i++) {
        html += `<div class="search-result-item skeleton-item">
            <div class="skeleton-thumb"></div>
            <div class="result-info">
                <div class="skeleton-line sk-title"></div>
                <div class="skeleton-line sk-sub"></div>
            </div>
        </div>`;
    }
    searchResultsList.innerHTML = html;
}

function renderSearchResults(items) {
    if (!searchResultsList || !searchResultsBox) return;
    searchResultsBox.classList.remove('hidden');

    if (!items || items.length === 0) {
        showSearchStatus('Không tìm thấy bài nào 😢 Thử từ khóa khác nhé!');
        return;
    }

    searchResultsList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    items.slice(0, 20).forEach(item => {
        // Lấy video ID — Piped dùng /watch?v=ID, Invidious dùng videoId field
        let videoId = item.videoId || null;
        if (!videoId) {
            const urlMatch = (item.url || '').match(/[?&v=\/]([a-zA-Z0-9_-]{11})(?:[?&]|$)/);
            if (urlMatch) videoId = urlMatch[1];
        }
        if (!videoId || videoId.length !== 11) return;

        const title = (item.title || 'Không có tiêu đề').replace(/</g, '&lt;');
        const channel = (item.uploaderName || item.author || '').replace(/</g, '&lt;');
        const duration = formatDuration(item.duration || item.lengthSeconds);
        // Ưu tiên thumbnail trực tiếp từ ytimg (nhanh hơn)
        const thumb = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

        const el = document.createElement('div');
        el.className = 'search-result-item';
        el.dataset.id = videoId;
        el.dataset.title = title;
        el.innerHTML = `
            <img class="result-thumb" src="${thumb}" alt="" loading="lazy"/>
            <div class="result-info">
                <div class="result-title" title="${title}">${title}</div>
                <div class="result-channel">${channel}</div>
            </div>
            ${duration ? `<span class="result-duration">${duration}</span>` : ''}
        `;

        el.addEventListener('click', () => {
            searchResultsList.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
            if (ytUrlInput) {
                ytUrlInput.value = 'https://www.youtube.com/watch?v=' + videoId;
                ytUrlInput.dataset.searchTitle = title;
            }
            trackChips.forEach(c => c.classList.remove('active'));
        });

        fragment.appendChild(el);
    });

    searchResultsList.appendChild(fragment);
}

// Fetch 1 instance với timeout tự động
function fetchInstance(instance, query, signal) {
    const ctrl = new AbortController();
    // Gắn signal ngoài vào
    signal.addEventListener('abort', () => ctrl.abort());

    const timeoutId = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);

    let url;
    if (instance.type === 'piped') {
        url = `${instance.base}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
    } else {
        // Invidious
        url = `${instance.base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,author,lengthSeconds`;
    }

    return fetch(url, { signal: ctrl.signal })
        .then(res => {
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(data => {
            clearTimeout(timeoutId);
            // Chuẩn hóa kết quả từ cả 2 loại API về cùng 1 format
            let items = [];
            if (instance.type === 'piped') {
                items = (data.items || []).filter(i => i.url);
            } else {
                // Invidious trả về array trực tiếp
                items = Array.isArray(data) ? data : [];
            }
            if (items.length === 0) throw new Error('empty');
            return items;
        })
        .catch(err => {
            clearTimeout(timeoutId);
            throw err;
        });
}

async function doSearch(query) {
    query = query.trim();
    if (!query) return;

    // Kiểm tra cache
    if (searchCache.has(query)) {
        renderSearchResults(searchCache.get(query));
        setSearchLoading(false);
        return;
    }

    // Hủy request cũ
    if (searchAbortCtrl) searchAbortCtrl.abort();
    searchAbortCtrl = new AbortController();
    const signal = searchAbortCtrl.signal;

    setSearchLoading(true);
    showSearchSkeleton();

    try {
        // Race tất cả instances song song — lấy response đầu tiên thành công
        const items = await Promise.any(
            SEARCH_INSTANCES.map(inst => fetchInstance(inst, query, signal))
        );

        if (signal.aborted) return;

        // Lưu cache (tối đa 15 queries)
        if (searchCache.size >= 15) {
            const firstKey = searchCache.keys().next().value;
            searchCache.delete(firstKey);
        }
        searchCache.set(query, items);

        renderSearchResults(items);
    } catch (err) {
        if (signal.aborted || (err && err.name === 'AbortError')) return;
        showSearchStatus('⚠️ Không kết nối được máy chủ tìm kiếm.<br>Hãy dán link YouTube thủ công nhé!', true);
    }

    setSearchLoading(false);
}

// Debounce auto-search khi gõ (350ms sau khi dừng gõ)
if (songSearchInput) {
    songSearchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        const q = songSearchInput.value.trim();
        if (q.length < 2) return;
        searchDebounceTimer = setTimeout(() => doSearch(q), 350);
    });

    songSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(searchDebounceTimer);
            const q = songSearchInput.value.trim();
            if (q) doSearch(q);
        }
    });
}

if (songSearchBtn) {
    songSearchBtn.addEventListener('click', () => {
        clearTimeout(searchDebounceTimer);
        const q = songSearchInput ? songSearchInput.value.trim() : '';
        if (q) doSearch(q);
    });
}

// Khi mở modal, reset search results
if (changeMusicBtn) {
    changeMusicBtn.addEventListener('click', () => {
        if (searchResultsBox) searchResultsBox.classList.add('hidden');
        if (searchResultsList) searchResultsList.innerHTML = '';
        if (songSearchInput) songSearchInput.value = '';
        if (ytUrlInput) delete ytUrlInput.dataset.searchTitle;
    });
}
