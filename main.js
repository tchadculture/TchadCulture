(function() {
    let cards = [];
    let streak = 0;
    let lastDay = null;
    let chart = null;
    let quizState = {
        questions: [],
        currentIndex: 0,
        score: 0,
        userAnswers: [],
        mode: 'start'
    };
    let reviewQueue = [];
    let reviewIdx = 0;

    const PRESETS = [
        { icon: "🥁", title: "Soro — Danse Tchadienne", q: "Qu'est-ce que le Soro ?", a: "Danse traditionnelle du Tchad, symbole d'unité nationale, exécutée lors des grandes cérémonies." },
        { icon: "🏛️", title: "Civilisation Sao", q: "Qu'est-ce que la civilisation Sao ?", a: "Ancienne civilisation autour du lac Tchad (XVe s. av. J.-C.), célèbre pour ses sculptures en terre cuite." },
        { icon: "🌍", title: "Capitale du Tchad", q: "Quelle est la capitale du Tchad ?", a: "N'Djaména, fondée en 1900, au confluent du Chari et du Logone." },
        { icon: "👑", title: "Premier Président", q: "Qui fut le premier président du Tchad ?", a: "François Tombalbaye, indépendance le 11 août 1960." }
    ];

    function save() {
        localStorage.setItem('na_cards', JSON.stringify(cards));
        localStorage.setItem('na_streak', streak);
        localStorage.setItem('na_last', lastDay || '');
    }

    function load() {
        try {
            const saved = localStorage.getItem('na_cards');
            if (saved) cards = JSON.parse(saved);
            streak = parseInt(localStorage.getItem('na_streak')) || 0;
            lastDay = localStorage.getItem('na_last') || null;
        } catch(e) { cards = []; }
    }

    function updateStreak() {
        const today = new Date().toLocaleDateString();
        if (lastDay !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDay === yesterday.toLocaleDateString()) streak++;
            else if (lastDay) streak = 0;
            else streak = 1;
            lastDay = today;
            save();
        }
        const streakElem = document.getElementById('streakVal');
        if (streakElem) streakElem.textContent = streak;
    }

    function getDue() {
        const now = Date.now();
        return cards.filter(c => new Date(c.nextReview || 0).getTime() <= now);
    }

    function addCard(front, back) {
        if (!front.trim() || !back.trim()) return false;
        if (cards.some(c => c.front.toLowerCase() === front.toLowerCase())) {
            toast("Cette carte existe déjà", "info");
            return false;
        }
        cards.push({
            id: Date.now(),
            front: front.trim(),
            back: back.trim(),
            level: 0,
            nextReview: new Date().toISOString()
        });
        save();
        updateAll();
        return true;
    }

    function deleteCard(id) {
        cards = cards.filter(c => c.id !== id);
        save();
        updateAll();
        renderLibrary();
    }

    function gradeCard(card, grade) {
        let lv = card.level || 0;
        if (grade === 4) lv = Math.min(5, lv + 1);
        else if (grade === 0) lv = Math.max(0, lv - 1);
        card.level = lv;
        const intervals = [0, 1, 3, 7, 14, 30];
        const days = intervals[lv] || 30;
        const next = new Date();
        next.setDate(next.getDate() + days);
        card.nextReview = next.toISOString();
        save();
        return days;
    }

    function updateAll() {
        const total = cards.length;
        const due = getDue().length;
        const mastered = cards.filter(c => (c.level || 0) >= 4).length;
        const mastery = total === 0 ? 0 : Math.round((mastered / total) * 100);
        
        const statTotal = document.getElementById('statTotal');
        const statDue = document.getElementById('statDue');
        const statMastery = document.getElementById('statMastery');
        const statRank = document.getElementById('statRank');
        if (statTotal) statTotal.textContent = total;
        if (statDue) statDue.textContent = due;
        if (statMastery) statMastery.textContent = mastery + '%';
        if (statRank) statRank.textContent = mastery >= 80 ? "MAÎTRE" : mastery >= 50 ? "GARDIEN" : mastery >= 20 ? "EXPLORATEUR" : "INITIÉ";
        
        const reviewBadge = document.getElementById('reviewCount');
        if (reviewBadge) {
            reviewBadge.textContent = due;
            reviewBadge.classList.toggle('show', due > 0);
        }
        
        const stTotal = document.getElementById('st_total');
        const stMastered = document.getElementById('st_mastered');
        const libSubtitle = document.getElementById('libSubtitle');
        if (stTotal) stTotal.textContent = total;
        if (stMastered) stMastered.textContent = mastered;
        if (libSubtitle) libSubtitle.textContent = total + ' carte' + (total !== 1 ? 's' : '') + ' encodée' + (total !== 1 ? 's' : '');
        
        updateChart(mastered, total - mastered);
    }

    function updateChart(mastered, learning) {
        const ctx = document.getElementById('statsChart');
        if (!ctx) return;
        if (chart) chart.destroy();
        chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Maîtrisé', 'Apprentissage'],
                datasets: [{ data: [mastered, learning], backgroundColor: ['#00f5ff', '#ff2d6e'], borderWidth: 0 }]
            },
            options: { cutout: '65%', responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#5a7a9a' } } } }
        });
    }

    function renderLibrary() {
        const container = document.getElementById('libraryGrid');
        if (!container) return;
        if (cards.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-database"></i></div><div>Aucune carte</div></div>';
            return;
        }
        container.innerHTML = cards.map(card => {
            const lv = card.level || 0;
            const dots = Array(5).fill().map((_, i) => `<div class="level-dot${i < lv ? ' filled' : ''}"></div>`).join('');
            return `<div class="memory-card"><div class="mc-question">${escapeHtml(card.front)}</div><div class="mc-answer">${escapeHtml(card.back)}</div><div class="mc-footer"><div class="level-pill"><span>NIV</span><div class="level-dots">${dots}</div><span>${lv}/5</span></div><button class="btn btn-danger btn-sm del-btn" data-id="${card.id}"><i class="fas fa-trash-alt"></i> Suppr</button></div></div>`;
        }).join('');
        document.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCard(parseInt(btn.dataset.id));
        }));
    }

    function renderQuiz() {
        const container = document.getElementById('quizContainer');
        if (!container) return;

        if (quizState.mode === 'start') {
            const totalCards = cards.length;
            container.innerHTML = `
                <div class="glass-panel" style="text-align: center;">
                    <i class="fas fa-gamepad" style="font-size: 3rem; color: var(--cyan); margin-bottom: 1rem;"></i>
                    <h3 style="margin-bottom: 1rem;">Testez vos compétences</h3>
                    <p style="color: var(--muted); margin-bottom: 1.5rem;">${totalCards} carte${totalCards !== 1 ? 's' : ''} disponible${totalCards !== 1 ? 's' : ''} à tester</p>
                    ${totalCards === 0 ? '<p style="color: var(--pink);">Créez des cartes pour commencer le test !</p>' : '<button class="btn btn-primary" id="startQuizBtn"><i class="fas fa-play"></i> COMMENCER LE TEST</button>'}
                </div>
            `;
            const startBtn = document.getElementById('startQuizBtn');
            if (startBtn) startBtn.addEventListener('click', startQuiz);
            return;
        }

        if (quizState.mode === 'result') {
            const percentage = Math.round((quizState.score / quizState.questions.length) * 100);
            const angle = (quizState.score / quizState.questions.length) * 360;
            container.innerHTML = `
                <div class="glass-panel" style="text-align: center;">
                    <div class="score-circle" id="scoreCircle" style="background: conic-gradient(var(--cyan) 0deg, var(--cyan-dim) 0deg);">
                        <div class="score-inner">
                            <span style="font-size: 2rem; font-weight: bold;">${quizState.score}</span>
                            <span style="font-size: 0.8rem;">/${quizState.questions.length}</span>
                        </div>
                    </div>
                    <h3>${percentage >= 80 ? '🏆 Excellent !' : percentage >= 60 ? '🎯 Très bien !' : percentage >= 40 ? '📚 Continuez vos révisions' : '💪 Encore un peu de travail'}</h3>
                    <p style="color: var(--muted); margin: 1rem 0;">Taux de réussite : ${percentage}%</p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" id="retryQuizBtn"><i class="fas fa-redo"></i> Recommencer</button>
                        <button class="btn btn-ghost" id="closeQuizBtn"><i class="fas fa-home"></i> Retour</button>
                    </div>
                </div>
            `;
            const circle = document.getElementById('scoreCircle');
            if (circle) circle.style.background = `conic-gradient(var(--cyan) 0deg ${angle}deg, var(--cyan-dim) ${angle}deg)`;
            const retryBtn = document.getElementById('retryQuizBtn');
            const closeBtn = document.getElementById('closeQuizBtn');
            if (retryBtn) retryBtn.addEventListener('click', startQuiz);
            if (closeBtn) closeBtn.addEventListener('click', () => {
                quizState.mode = 'start';
                renderQuiz();
            });
            return;
        }

        const q = quizState.questions[quizState.currentIndex];
        const currentAnswer = quizState.userAnswers[quizState.currentIndex];
        
        container.innerHTML = `
            <div class="glass-panel">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
                    <span style="color: var(--cyan);">Question ${quizState.currentIndex + 1}/${quizState.questions.length}</span>
                    <span style="color: var(--muted);">Score: ${quizState.score}</span>
                </div>
                <div style="margin-bottom: 2rem;">
                    <h3 style="font-family: var(--font-hd); margin-bottom: 1rem;">${escapeHtml(q.front)}</h3>
                    <div id="answerOptions"></div>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-ghost" id="skipQuizBtn"><i class="fas fa-forward"></i> Passer</button>
                    <button class="btn btn-primary" id="submitQuizBtn" ${!currentAnswer ? 'disabled' : ''}><i class="fas fa-check"></i> Valider</button>
                </div>
            </div>
        `;
        
        const optionsDiv = document.getElementById('answerOptions');
        const options = generateOptions(q.back);
        options.forEach(opt => {
            const optDiv = document.createElement('div');
            optDiv.className = `quiz-option${currentAnswer === opt ? ' selected' : ''}`;
            optDiv.innerHTML = `<i class="fas ${opt === q.back ? 'fa-brain' : 'fa-microchip'}"></i> ${escapeHtml(opt)}`;
            optDiv.addEventListener('click', () => selectAnswer(opt));
            optionsDiv.appendChild(optDiv);
        });
        
        const skipBtn = document.getElementById('skipQuizBtn');
        const submitBtn = document.getElementById('submitQuizBtn');
        if (skipBtn) skipBtn.addEventListener('click', skipQuestion);
        if (submitBtn) submitBtn.addEventListener('click', submitAnswer);
    }
    
    function generateOptions(correctAnswer) {
        const allAnswers = cards.map(c => c.back).filter(a => a !== correctAnswer);
        const shuffled = [...new Set(allAnswers)].sort(() => Math.random() - 0.5);
        const options = [correctAnswer];
        for (let i = 0; i < Math.min(3, shuffled.length); i++) options.push(shuffled[i]);
        return options.sort(() => Math.random() - 0.5);
    }
    
    function selectAnswer(opt) {
        quizState.userAnswers[quizState.currentIndex] = opt;
        renderQuiz();
        const submitBtn = document.getElementById('submitQuizBtn');
        if (submitBtn) submitBtn.disabled = false;
    }
    
    function skipQuestion() {
        quizState.userAnswers[quizState.currentIndex] = null;
        nextQuestion();
    }
    
    function submitAnswer() {
        const currentAnswer = quizState.userAnswers[quizState.currentIndex];
        const correctAnswer = quizState.questions[quizState.currentIndex].back;
        if (currentAnswer === correctAnswer) quizState.score++;
        nextQuestion();
    }
    
    function nextQuestion() {
        if (quizState.currentIndex + 1 < quizState.questions.length) {
            quizState.currentIndex++;
            renderQuiz();
        } else {
            quizState.mode = 'result';
            renderQuiz();
        }
    }
    
    function startQuiz() {
        if (cards.length === 0) {
            toast("Créez des cartes avant de commencer le test !", "info");
            return;
        }
        quizState.questions = [...cards];
        quizState.currentIndex = 0;
        quizState.score = 0;
        quizState.userAnswers = new Array(cards.length).fill(null);
        quizState.mode = 'quiz';
        renderQuiz();
    }

    function renderReview() {
        const container = document.getElementById('reviewContainer');
        if (!container) return;
        
        if (reviewQueue.length === 0 || reviewIdx >= reviewQueue.length) {
            reviewQueue = getDue();
            reviewIdx = 0;
        }
        
        if (reviewQueue.length === 0) {
            container.innerHTML = '<div class="review-card-stage"><i class="fas fa-check-circle" style="font-size:3rem;color:var(--cyan);"></i><div>Aucune révision due</div></div>';
            return;
        }
        
        const card = reviewQueue[reviewIdx];
        container.innerHTML = `
            <div class="review-card-stage">
                <div class="review-q">${escapeHtml(card.front)}</div>
                <div class="review-a" id="answerBox" style="display:none;">${escapeHtml(card.back)}</div>
                <div id="revealWrap"><button class="btn btn-ghost" id="revealBtn"><i class="fas fa-eye"></i> Révéler</button></div>
                <div id="gradeWrap" style="display:none;">
                    <button class="grade-btn hard" data-grade="0">Difficile</button>
                    <button class="grade-btn medium" data-grade="2">Moyen</button>
                    <button class="grade-btn easy" data-grade="4">Facile</button>
                </div>
            </div>
        `;
        
        const revealBtn = document.getElementById('revealBtn');
        if (revealBtn) {
            revealBtn.addEventListener('click', () => {
                const answerBox = document.getElementById('answerBox');
                const revealWrap = document.getElementById('revealWrap');
                const gradeWrap = document.getElementById('gradeWrap');
                if (answerBox) answerBox.style.display = 'block';
                if (revealWrap) revealWrap.style.display = 'none';
                if (gradeWrap) gradeWrap.style.display = 'block';
            });
        }
        
        document.querySelectorAll('.grade-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                gradeCard(card, parseInt(btn.dataset.grade));
                reviewQueue.splice(reviewIdx, 1);
                updateAll();
                renderReview();
            });
        });
    }

    function renderExplore() {
        const grid = document.getElementById('exploreGrid');
        if (!grid) return;
        grid.innerHTML = PRESETS.map((p, i) => `
            <div class="explore-card">
                <div class="explore-icon">${p.icon}</div>
                <div class="explore-title">${escapeHtml(p.title)}</div>
                <div class="explore-desc">${escapeHtml(p.q)}</div>
                <button class="btn btn-ghost btn-sm add-preset" data-index="${i}"><i class="fas fa-plus-circle"></i> Importer</button>
            </div>
        `).join('');
        document.querySelectorAll('.add-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = PRESETS[parseInt(btn.dataset.index)];
                if (addCard(p.q, p.a)) toast(`${p.title} importé !`, "success");
                renderExplore();
            });
        });
    }

    function navigate(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) targetPage.classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        if (pageId === 'library') renderLibrary();
        if (pageId === 'review') {
            reviewQueue = [];
            reviewIdx = 0;
            renderReview();
        }
        if (pageId === 'explore') renderExplore();
        if (pageId === 'quiz') renderQuiz();
        if (window.innerWidth <= 768) closeSidebar();
    }

    function toast(msg, type = "info") {
        const wrap = document.getElementById('toastWrap');
        if (!wrap) return;
        const el = document.createElement('div');
        el.className = 'toast';
        el.style.borderLeft = `3px solid ${type === 'success' ? 'var(--green)' : 'var(--cyan)'}`;
        el.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-bolt'}"></i> ${escapeHtml(msg)}`;
        wrap.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('open');
    }
    
    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }

    function init() {
        load();
        updateStreak();
        if (cards.length === 0) {
            cards.push({ id: Date.now(), front: "Quelle est la capitale du Tchad ?", back: "N'Djaména", level: 0, nextReview: new Date().toISOString() });
            cards.push({ id: Date.now() + 1, front: "Qui fut le premier président du Tchad ?", back: "François Tombalbaye", level: 0, nextReview: new Date().toISOString() });
            save();
        }
        updateAll();
        renderLibrary();
        renderExplore();
        renderQuiz();
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => navigate(btn.dataset.page));
        });
        
        const cardForm = document.getElementById('cardForm');
        if (cardForm) {
            cardForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const front = document.getElementById('frontInput').value;
                const back = document.getElementById('backInput').value;
                if (addCard(front, back)) {
                    document.getElementById('frontInput').value = '';
                    document.getElementById('backInput').value = '';
                    toast("Carte créée !", "success");
                } else if (!front.trim() || !back.trim()) {
                    toast("Remplissez tous les champs", "error");
                }
            });
        }
        
        const mobToggle = document.getElementById('mobToggle');
        if (mobToggle) {
            mobToggle.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('open')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            });
        }
        
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', closeSidebar);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();