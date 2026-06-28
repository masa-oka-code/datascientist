let quizData = [];
let remainingQuestions = [];

async function init() {
    try {
        const res = await fetch('data.json');
        quizData = await res.json();
        document.getElementById('btn-all').disabled = false;
        document.getElementById('btn-cat').disabled = false;
        showScreen('top-screen');
    } catch (e) {
        console.error("データ読み込み失敗", e);
        const top = document.getElementById('top-screen');
        top.style.display = 'flex';
        const errMsg = document.createElement('p');
        errMsg.innerText = "問題データの読み込みに失敗しました。ページを再読み込みしてください。";
        errMsg.style.color = 'red';
        top.appendChild(errMsg);
    }
}
init();

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'flex';
    if (id === 'top-screen') {
        document.getElementById('btn-all').style.display = '';
        document.getElementById('btn-cat').style.display = '';
        document.getElementById('category-menu').style.display = 'none';
    }
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const RELATED_QUESTIONS_LIMIT = 5;

function getRelatedQuestions(quiz, allData) {
    const quizTags = quiz.tags || [];
    const scored = allData
        .filter(q => q.id !== quiz.id)
        .map(q => {
            let score = 0;
            if (q.concept_id === quiz.concept_id) score += 10;
            const qTags = q.tags || [];
            const sharedTagCount = qTags.filter(t => quizTags.includes(t)).length;
            score += sharedTagCount;
            return { question: q, score };
        })
        .filter(x => x.score > 0);

    shuffleArray(scored);
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, RELATED_QUESTIONS_LIMIT).map(x => x.question);
}

function showCategoryMenu() {
    document.getElementById('btn-all').style.display = 'none';
    document.getElementById('btn-cat').style.display = 'none';
    document.getElementById('category-menu').style.display = 'block';
    const btnContainer = document.getElementById('category-buttons');
    const cats = [...new Set(quizData.map(q => q.category))];
    btnContainer.innerHTML = '';
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.innerText = cat;
        btn.onclick = () => startQuiz(cat, 'category');
        btnContainer.appendChild(btn);
    });
}

function startQuiz(filterValue, filterType) {
    let pool;
    if (filterType === 'all') {
        pool = [...quizData];
    } else if (filterType === 'category') {
        pool = quizData.filter(q => q.category === filterValue);
    } else if (filterType === 'subcategory') {
        pool = quizData.filter(q => q.subcategory === filterValue);
    } else if (filterType === 'concept') {
        pool = quizData.filter(q => q.concept_id === filterValue);
    } else {
        pool = [];
    }

    if (pool.length === 0) { alert("問題なし"); return; }
    
    remainingQuestions = shuffleArray(pool).slice(0, 10);
    showScreen('quiz-screen');
    nextQuestion();
}

function nextQuestion() {
    if (remainingQuestions.length === 0) {
        alert("学習終了！");
        location.reload();
        return;
    }
    showQuestion(remainingQuestions.pop());
}

function showQuestion(quiz) {
    clearFeedback();
    document.getElementById('question').innerText = `[${quiz.subcategory}] ${quiz.question}`;
    const container = document.getElementById('choices-container');
    container.innerHTML = '';

    // ★選択肢をランダムにシャッフルする
    const shuffledChoices = shuffleArray([...quiz.choices]);

    shuffledChoices.forEach(c => {
        const btn = document.createElement('button');
        btn.innerText = c;
        btn.className = 'choice-btn';
        btn.onclick = () => handleAnswer(c, quiz);
        container.appendChild(btn);
    });
    const quitBtn = document.createElement('button');
    quitBtn.innerText = "学習を中断してトップへ戻る";
    quitBtn.className = 'back-btn';
    quitBtn.onclick = () => {
        if (confirm("学習を中断してトップに戻りますか？\n（ここまでの回答結果は成績に保存されます）")) {
            remainingQuestions = [];
            showScreen('top-screen');
        }
    };
    container.appendChild(quitBtn);
}

function handleAnswer(selected, quiz) {
    const isCorrect = (selected === quiz.answer);

    const logs = JSON.parse(localStorage.getItem('quizLogs') || '[]');
    logs.push({
        subcategory: quiz.subcategory,
        category: quiz.category,
        concept_id: quiz.concept_id,
        concept_parent: quiz.concept_parent,   // ★階層追加
        concept_root: quiz.concept_root,       // ★階層追加
        isCorrect,
        timestamp: Date.now()
    });
    localStorage.setItem('quizLogs', JSON.stringify(logs));
    
    document.getElementById('choices-container').innerHTML = '';
    renderFeedback(quiz, isCorrect);
    
    if (!isCorrect) {
        const related = getRelatedQuestions(quiz, quizData);
        related.forEach(q => {
            const btn = document.createElement('button');
            btn.innerText = q.question;
            btn.className = 'choice-btn';
            btn.onclick = () => showQuestion(q);
            document.getElementById('choices-container').appendChild(btn);
        });
    }
    
    const nextBtn = document.createElement('button');
    nextBtn.innerText = "次の問題へ";
    nextBtn.className = 'next-btn';
    nextBtn.onclick = () => { clearFeedback(); nextQuestion(); };
    document.getElementById('choices-container').appendChild(nextBtn);

    const quitBtn = document.createElement('button');
    quitBtn.innerText = "学習を中断してトップへ戻る";
    quitBtn.className = 'back-btn';
    quitBtn.onclick = () => {
        if (confirm("学習を中断してトップに戻りますか？\n（ここまでの回答結果は成績に保存されます）")) {
            remainingQuestions = [];
            clearFeedback();
            showScreen('top-screen');
        }
    };
    document.getElementById('choices-container').appendChild(quitBtn);
}

function clearFeedback() {
    const feedbackEl = document.getElementById('feedback');
    feedbackEl.innerHTML = '';
    feedbackEl.className = '';
}

function renderFeedback(quiz, isCorrect) {
    const feedbackEl = document.getElementById('feedback');
    feedbackEl.innerHTML = '';
    feedbackEl.className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';

    const layers = quiz.explanation_layers && quiz.explanation_layers.length > 0
        ? quiz.explanation_layers
        : ['解説は準備中です。'];

    const resultLabel = document.createElement('p');
    resultLabel.className = 'feedback-result-label';
    resultLabel.innerText = isCorrect ? '正解' : '不正解';
    feedbackEl.appendChild(resultLabel);

    const layerList = document.createElement('div');
    layerList.className = 'feedback-layers';
    feedbackEl.appendChild(layerList);

    let revealedCount = 0;

    function revealNextLayer() {
        if (revealedCount >= layers.length) return;
        const p = document.createElement('p');
        p.className = 'feedback-layer';
        p.innerText = layers[revealedCount];
        layerList.appendChild(p);
        revealedCount++;
        updateMoreButton();
    }

    let moreBtn = null;
    function updateMoreButton() {
        if (moreBtn) {
            moreBtn.remove();
            moreBtn = null;
        }
        if (revealedCount < layers.length) {
            moreBtn = document.createElement('button');
            moreBtn.className = 'more-detail-btn';
            moreBtn.innerText = 'もっと詳しく';
            moreBtn.onclick = revealNextLayer;
            feedbackEl.appendChild(moreBtn);
        }
    }

    revealNextLayer();
}

function showReportScreen() {
    showScreen('report-screen');
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const logs = JSON.parse(localStorage.getItem('quizLogs') || '[]')
        .filter(l => l.timestamp >= cutoff);

    const content = document.getElementById('report-content');
    content.innerHTML = '';

    renderWeakConcepts(logs, content);
    renderWeakHierarchy(logs, content);   // ★階層弱点分析追加

    const stats = {};
    logs.forEach(l => {
        const cat = l.category || "未分類";
        const sub = l.subcategory || "その他";
        if (!stats[cat]) stats[cat] = {};
        if (!stats[cat][sub]) stats[cat][sub] = { c: 0, t: 0 };
        stats[cat][sub].t++;
        if (l.isCorrect) stats[cat][sub].c++;
    });
    for (let cat in stats) {
        const catTitle = document.createElement('div');
        catTitle.className = 'cat-title';
        catTitle.innerText = cat;
        content.appendChild(catTitle);
        for (let sub in stats[cat]) {
            const s = stats[cat][sub];
            const rate = Math.round((s.c / s.t) * 100);
            const div = document.createElement('div');
            div.className = 'sub-row';
            div.innerHTML = `<div>${sub}: ${rate}%</div><div class="report-bar"><div class="report-fill" style="width: ${rate}%"></div></div>`;
            div.onclick = () => startQuiz(sub, 'subcategory');
            content.appendChild(div);
        }
    }
}

const MIN_ATTEMPTS_FOR_WEAK_CONCEPT = 2;
const WEAK_CONCEPT_DISPLAY_LIMIT = 5;

function renderWeakConcepts(logs, content) {
    const conceptStats = {};
    logs.forEach(l => {
        if (!l.concept_id) return;
        if (!conceptStats[l.concept_id]) {
            const sampleQuestion = quizData.find(q => q.concept_id === l.concept_id);
            conceptStats[l.concept_id] = {
                conceptId: l.concept_id,
                label: sampleQuestion ? sampleQuestion.subcategory : l.concept_id,
                c: 0,
                t: 0
            };
        }
        conceptStats[l.concept_id].t++;
        if (l.isCorrect) conceptStats[l.concept_id].c++;
    });

    const weakList = Object.values(conceptStats)
        .filter(s => s.t >= MIN_ATTEMPTS_FOR_WEAK_CONCEPT)
        .map(s => ({ ...s, rate: Math.round((s.c / s.t) * 100) }))
        .sort((a, b) => a.rate - b.rate)
        .slice(0, WEAK_CONCEPT_DISPLAY_LIMIT);

    if (weakList.length === 0) return;

    const title = document.createElement('div');
    title.className = 'cat-title weak-concept-title';
    title.innerText = '苦手な概念 TOP5';
    content.appendChild(title);

    weakList.forEach(s => {
        const div = document.createElement('div');
        div.className = 'sub-row weak-concept-row';
        div.innerHTML = `<div>${s.label}: ${s.rate}%<span class="weak-concept-count">（${s.t}回中${s.c}回正解）</span></div><div class="report-bar"><div class="report-fill" style="width: ${s.rate}%"></div></div>`;
        div.onclick = () => startQuiz(s.conceptId, 'concept');
        content.appendChild(div);
    });
}

// ▼▼▼ 階層弱点分析 ▼▼▼
function renderWeakHierarchy(logs, content) {
    const parentStats = {};
    const rootStats = {};

    logs.forEach(l => {
        if (l.concept_parent) {
            if (!parentStats[l.concept_parent]) parentStats[l.concept_parent] = { t: 0, c: 0 };
            parentStats[l.concept_parent].t++;
            if (l.isCorrect) parentStats[l.concept_parent].c++;
        }

        if (l.concept_root) {
            if (!rootStats[l.concept_root]) rootStats[l.concept_root] = { t: 0, c: 0 };
            rootStats[l.concept_root].t++;
            if (l.isCorrect) rootStats[l.concept_root].c++;
        }
    });

    const parentList = Object.entries(parentStats)
        .filter(([_, s]) => s.t >= MIN_ATTEMPTS_FOR_WEAK_CONCEPT)
        .map(([parent, s]) => ({
            parent,
            rate: Math.round((s.c / s.t) * 100),
            t: s.t,
            c: s.c
        }))
        .sort((a, b) => a.rate - b.rate)
        .slice(0, WEAK_CONCEPT_DISPLAY_LIMIT);

    if (parentList.length > 0) {
        const title = document.createElement('div');
        title.className = 'cat-title weak-concept-title';
        title.innerText = '苦手な中分類（concept_parent）';
        content.appendChild(title);

        parentList.forEach(s => {
            const div = document.createElement('div');
            div.className = 'sub-row weak-concept-row';
            div.innerHTML =
                `<div>${s.parent}: ${s.rate}%（${s.t}回中${s.c}回正解）</div>
                 <div class="report-bar"><div class="report-fill" style="width: ${s.rate}%"></div></div>`;
            div.onclick = () => startQuiz(s.parent, 'subcategory');
            content.appendChild(div);
        });
    }

    const rootList = Object.entries(rootStats)
        .filter(([_, s]) => s.t >= MIN_ATTEMPTS_FOR_WEAK_CONCEPT)
        .map(([root, s]) => ({
            root,
            rate: Math.round((s.c / s.t) * 100),
            t: s.t,
            c: s.c
        }))
        .sort((a, b) => a.rate - b.rate)
        .slice(0, WEAK_CONCEPT_DISPLAY_LIMIT);

    if (rootList.length > 0) {
        const title = document.createElement('div');
        title.className = 'cat-title weak-concept-title';
        title.innerText = '苦手な大分類（concept_root）';
        content.appendChild(title);

        rootList.forEach(s => {
            const div = document.createElement('div');
            div.className = 'sub-row weak-concept-row';
            div.innerHTML =
                `<div>${s.root}: ${s.rate}%（${s.t}回中${s.c}回正解）</div>
                 <div class="report-bar"><div class="report-fill" style="width: ${s.rate}%"></div></div>`;
            div.onclick = () => startQuiz(s.root, 'category');
            content.appendChild(div);
        });
    }
    let deferredPrompt = null;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const btn = document.getElementById("install-btn");
      if (btn) btn.style.display = "block";
    });

    function installApp() {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
        const btn = document.getElementById("install-btn");
        if (btn) btn.style.display = "none";
      });
    }

}
