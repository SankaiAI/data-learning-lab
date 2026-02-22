// ═══════════════════════════════════════
// APP ENGINE
// ═══════════════════════════════════════
import { askStakeholder, buildConversationContext } from './llm.js';


const container = document.getElementById('messagesContainer');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const memberListEl = document.getElementById('memberList');
const deliverablesListEl = document.getElementById('deliverablesList');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');

let currentIndex = 0;
let paused = false;
let speed = 1;
let timeouts = [];
let typingEl = null;

const SPEEDS = [1, 2, 5];
let speedIdx = 0;

const BASE_DELAY = 1800;   // ms between messages
const TYPING_DELAY = 900;  // ms the typing indicator shows

// ─── Render sidebar members ─────────────
function renderMembers() {
    memberListEl.innerHTML = '';
    Object.values(STAKEHOLDERS).forEach(s => {
        const el = document.createElement('div');
        el.className = 'member-item';
        el.innerHTML = `
      <div class="member-avatar-sm" style="background:${s.roleColor}; border: 1px solid ${s.roleBorder}">
        ${s.emoji}
      </div>
      <span>${s.name}</span>
    `;
        memberListEl.appendChild(el);
    });
}

// ─── Render a single message ─────────────
function renderMessage(msg) {
    if (msg.type === 'phase') {
        renderPhase(msg);
        return;
    }
    if (msg.type === 'system') {
        renderSystem(msg);
        return;
    }

    const s = STAKEHOLDERS[msg.sender];
    const group = document.createElement('div');
    group.className = 'message-group';

    let attachmentHTML = '';
    if (msg.attachment) {
        const a = msg.attachment;
        attachmentHTML = `
      <div class="attachment ${a.type}">
        <div class="attachment-label">${a.label}</div>
        <div class="attachment-title">${a.title}</div>
        <div class="attachment-body">${a.body}</div>
      </div>
    `;
    }

    let reactionsHTML = '';
    if (msg.reactions && msg.reactions.length) {
        reactionsHTML = `<div style="margin-top:6px">` +
            msg.reactions.map(r => `<span class="reaction">${r}</span>`).join('') +
            `</div>`;
    }

    group.innerHTML = `
    <div class="avatar" style="background:${s.roleColor}; border: 1.5px solid ${s.roleBorder}">${s.emoji}</div>
    <div class="message-body">
      <div class="message-meta">
        <span class="sender-name" style="color:${s.color}">${s.name}</span>
        <span class="sender-role" style="background:${s.roleColor}; color:${s.color}; border: 1px solid ${s.roleBorder}">${s.role}</span>
        <span class="message-time">${msg.time}</span>
      </div>
      <div class="message-bubble ${msg.attachment ? 'has-attachment' : ''}">
        ${msg.text}
        ${attachmentHTML}
      </div>
      ${reactionsHTML}
    </div>
  `;

    container.appendChild(group);
    scrollToBottom();

    // Add deliverable card if present
    if (msg.deliverableCard) {
        addDeliverableCard(msg.deliverableCard);
    }
}

function renderPhase(msg) {
    const div = document.createElement('div');
    div.className = 'phase-divider';
    div.innerHTML = `<div class="phase-badge ${msg.phase}">${msg.label}</div>`;
    container.appendChild(div);
    scrollToBottom();
}

function renderSystem(msg) {
    const div = document.createElement('div');
    div.className = 'message-group system';
    div.innerHTML = `<div class="system-msg">${msg.text}</div>`;
    container.appendChild(div);
    scrollToBottom();
}

function addDeliverableCard(card) {
    // Remove empty state if present
    const empty = deliverablesListEl.querySelector('.empty-state');
    if (empty) empty.remove();

    const el = document.createElement('div');
    el.className = 'deliverable-card';
    el.innerHTML = `
    <div class="deliverable-from" style="color:${card.color}">${card.from}</div>
    <div class="deliverable-name">${card.name}</div>
    <div class="deliverable-desc">${card.desc}</div>
  `;
    deliverablesListEl.appendChild(el);
}

// ─── Typing indicator ────────────────────
function showTyping(sender) {
    removeTyping();
    if (!sender) return;
    const s = STAKEHOLDERS[sender];
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typingIndicator';
    el.innerHTML = `
    <div class="avatar" style="background:${s.roleColor}; border: 1.5px solid ${s.roleBorder}; width:32px; height:32px; font-size:14px">${s.emoji}</div>
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
    <div class="typing-name">${s.name} is typing...</div>
  `;
    container.appendChild(el);
    scrollToBottom();
}

function removeTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}

// ─── Progress bar ───────────────────────
function updateProgress() {
    const pct = Math.round((currentIndex / MESSAGES.length) * 100);
    progressBar.style.width = pct + '%';

    const msg = MESSAGES[currentIndex - 1];
    if (msg) {
        if (msg.type === 'phase') progressLabel.textContent = msg.label;
        else if (msg.type === 'system') progressLabel.textContent = msg.text;
        else progressLabel.textContent = `${STAKEHOLDERS[msg.sender]?.name || ''}: "${msg.text.slice(0, 60)}..."`;
    }
}

// ─── Scroll ────────────────────────────
function scrollToBottom() {
    container.scrollTop = container.scrollHeight;
}

// ─── Schedule next message ──────────────
function scheduleNext() {
    if (paused || currentIndex >= MESSAGES.length) {
        if (currentIndex >= MESSAGES.length) {
            progressBar.style.width = '100%';
            progressLabel.textContent = '✅ Experiment complete — all phases simulated!';
        }
        return;
    }

    const msg = MESSAGES[currentIndex];
    const delay = BASE_DELAY / speed;
    const typingDelay = TYPING_DELAY / speed;

    if (msg.sender && !msg.type) {
        // Show typing indicator first
        const t1 = setTimeout(() => {
            if (!paused) showTyping(msg.sender);
        }, 100);
        const t2 = setTimeout(() => {
            if (!paused) {
                removeTyping();
                renderMessage(msg);
                currentIndex++;
                updateProgress();
                scheduleNext();
            }
        }, typingDelay + delay);
        timeouts.push(t1, t2);
    } else {
        const t = setTimeout(() => {
            if (!paused) {
                renderMessage(msg);
                currentIndex++;
                updateProgress();
                scheduleNext();
            }
        }, delay * 0.5);
        timeouts.push(t);
    }
}

// ─── Controls ──────────────────────────
document.getElementById('btnReplay').addEventListener('click', () => {
    timeouts.forEach(t => clearTimeout(t));
    timeouts = [];
    currentIndex = 0;
    paused = false;
    container.innerHTML = '';
    deliverablesListEl.innerHTML = '<div class="empty-state">Deliverables will appear here as the conversation progresses.</div>';
    progressBar.style.width = '0%';
    progressLabel.textContent = 'Getting started...';
    document.getElementById('btnPause').textContent = '⏸ Pause';
    scheduleNext();
});

document.getElementById('btnPause').addEventListener('click', () => {
    paused = !paused;
    document.getElementById('btnPause').textContent = paused ? '▶ Resume' : '⏸ Pause';
    if (!paused) scheduleNext();
});

document.getElementById('btnSpeed').addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    speed = SPEEDS[speedIdx];
    document.getElementById('btnSpeed').textContent = `⚡ Speed: ${speed}×`;
});

document.getElementById('btnJumpEnd').addEventListener('click', () => {
    // Cancel any pending timeouts
    timeouts.forEach(t => clearTimeout(t));
    timeouts = [];
    removeTyping();

    // Render all remaining messages instantly
    while (currentIndex < MESSAGES.length) {
        renderMessage(MESSAGES[currentIndex]);
        currentIndex++;
    }

    // Update progress to 100%
    progressBar.style.width = '100%';
    progressLabel.textContent = '✅ Experiment complete — all phases simulated!';
    document.getElementById('btnPause').textContent = '⏸ Pause';
    paused = false;

    scrollToBottom();
});

// ─── Sidebar channel filters ────────────
document.querySelectorAll('.channel').forEach(ch => {
    ch.addEventListener('click', () => {
        document.querySelectorAll('.channel').forEach(c => c.classList.remove('active'));
        ch.classList.add('active');

        const phase = ch.dataset.phase;
        if (phase === 'all') {
            chatTitle.textContent = 'Full A/B Test Process Simulation';
            chatSubtitle.textContent = 'A real-world simulation of how teams collaborate to run an A/B test';
        } else {
            const phaseNames = {
                phase1: 'Phase 1 — Idea & Hypothesis',
                phase2: 'Phase 2 — Test Design & Setup',
                phase3: 'Phase 3 — Launch & Monitoring',
                phase4: 'Phase 4 — Analysis & Decision',
            };
            chatTitle.textContent = phaseNames[phase] || 'A/B Test';
            chatSubtitle.textContent = 'Jump to this phase in the conversation';
        }

        if (phase !== 'all') {
            // Scroll to phase divider
            const phaseEls = container.querySelectorAll('.phase-divider');
            const phaseMap = { 'phase1': 0, 'phase2': 1, 'phase3': 2, 'phase4': 3 };
            const idx = phaseMap[phase];
            if (phaseEls[idx]) {
                phaseEls[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            container.scrollTop = 0;
        }
    });
});

// ─── Guide Modal ──────────────────────
function renderGuide() {
    const body = document.getElementById('modalBody');
    body.innerHTML = WORKFLOW_GUIDE.map(step => `
    <div class="workflow-step">
      <div class="step-number">${step.step}</div>
      <div class="step-content">
        <div class="step-title">${step.title}</div>
        <div class="step-desc">${step.desc}</div>
        <div class="step-who">
          <span style="color: var(--text-muted); margin-right: 4px">Who:</span>
          ${step.who.map(w => `<span class="who-tag" style="background:var(--bg-hover); border: 1px solid var(--border);">${w}</span>`).join('')}
        </div>
        <div class="step-tip">${step.tip}</div>
      </div>
    </div>
  `).join('');
}

document.getElementById('guideBtn').addEventListener('click', () => {
    renderGuide();
    document.getElementById('guideModal').classList.add('open');
});

document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('guideModal').classList.remove('open');
});

document.getElementById('guideModal').addEventListener('click', (e) => {
    if (e.target.id === 'guideModal') {
        document.getElementById('guideModal').classList.remove('open');
    }
});

// ─── Init ───────────────────────────────
renderMembers();
scheduleNext();

// ─── Q&A Input — LLM Integration ────────
const qaInput = document.getElementById('qaInput');
const qaSendBtn = document.getElementById('qaSendBtn');
const qaStatus = document.getElementById('qaStatus');
const qaWrap = document.getElementById('qaInputWrap');

// Track extra messages added by LLM (to include in context)
const llmHistory = [];

// Auto-grow the textarea as user types
qaInput.addEventListener('input', () => {
    qaInput.style.height = 'auto';
    qaInput.style.height = Math.min(qaInput.scrollHeight, 80) + 'px';
});

// Submit on Enter (Shift+Enter = newline)
qaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleQASubmit();
    }
});

qaSendBtn.addEventListener('click', handleQASubmit);

async function handleQASubmit() {
    const question = qaInput.value.trim();
    if (!question) return;

    // Disable input while loading
    qaInput.value = '';
    qaInput.style.height = 'auto';
    qaSendBtn.disabled = true;
    qaWrap.classList.add('loading');
    setQAStatus('thinking', '✨ Finding the right team member...');

    // Build the full conversation context from scripted messages + prior LLM replies
    const allContext = buildConversationContext([...MESSAGES, ...llmHistory]);

    try {
        // Show a generic "thinking" typing indicator while we wait for LLM
        showTyping('ds'); // Default avatar while we don't know who'll answer yet

        const { stakeholder, message } = await askStakeholder(question, allContext);

        removeTyping();

        // Show the correct stakeholder typing briefly before rendering
        showTyping(stakeholder);
        await delay(700);
        removeTyping();

        // Render the LLM reply as a real chat message with an AI badge
        renderLLMMessage(stakeholder, message, question);

        // Save to LLM history so follow-ups have context
        llmHistory.push({ sender: stakeholder, text: message, time: 'just now' });

        setQAStatus('', '');
    } catch (err) {
        removeTyping();
        if (err.message === 'MISSING_KEY') {
            setQAStatus('error', '⚠️ API key missing — add your Gemini key to .env');
        } else {
            setQAStatus('error', `⚠️ Error: ${err.message}`);
        }
    } finally {
        qaSendBtn.disabled = false;
        qaWrap.classList.remove('loading');
        qaInput.focus();
    }
}

function renderLLMMessage(senderId, text, userQuestion) {
    const s = STAKEHOLDERS[senderId];
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Render the user's question as a right-aligned bubble
    const userGroup = document.createElement('div');
    userGroup.className = 'message-group user-msg';
    userGroup.innerHTML = `
    <div class="avatar" style="background:linear-gradient(135deg,#6c63f5,#8b5cf6); border:1.5px solid rgba(139,92,246,0.5)">🧑</div>
    <div class="user-bubble-wrap">
      <div class="user-label">You · ${now}</div>
      <div class="user-bubble">${userQuestion}</div>
    </div>
  `;
    container.appendChild(userGroup);

    // Render the stakeholder's reply
    const group = document.createElement('div');
    group.className = 'message-group';
    group.innerHTML = `
    <div class="avatar" style="background:${s.roleColor}; border: 1.5px solid ${s.roleBorder}">${s.emoji}</div>
    <div class="message-body">
      <div class="message-meta">
        <span class="sender-name" style="color:${s.color}">${s.name}</span>
        <span class="sender-role" style="background:${s.roleColor}; color:${s.color}; border: 1px solid ${s.roleBorder}">${s.role}</span>
        <span class="ai-badge">✨ AI</span>
        <span class="message-time">${now}</span>
      </div>
      <div class="message-bubble">${text}</div>
    </div>
  `;

    container.appendChild(group);
    scrollToBottom();
}


function setQAStatus(type, text) {
    qaStatus.className = 'qa-status' + (type ? ` ${type}` : '');
    qaStatus.textContent = text;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

