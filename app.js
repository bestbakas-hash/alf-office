/* ────────────────────────────────────────────────────────────
   합동 비서실 — app.js
   data/office.json → 도트 오피스 말풍선 · 상황판 · 지시 작성기
   ──────────────────────────────────────────────────────────── */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STATUS_CLASS = { "작업중": "working", "대기중": "idle", "완료": "done" };
  const DRAFT_KEY = "alf-office-draft";
  const DRAFT_TIME_KEY = "alf-office-draft-saved";

  const state = { data: null, toastTimer: null, saveTimer: null };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

  /* ── 시계 ─────────────────────────────────────────────── */
  function tickClock() {
    const el = $("#clock");
    if (!el) return;
    try {
      el.textContent = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul", hour12: false,
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      }).format(new Date());
    } catch {
      el.textContent = new Date().toLocaleTimeString("ko-KR");
    }
  }

  /* ── 토스트 ───────────────────────────────────────────── */
  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("is-on"), 2200);
  }

  /* ── 데이터 불러오기 ──────────────────────────────────── */
  async function loadOffice() {
    try {
      const res = await fetch("data/office.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.agents)) throw new Error("형식 오류");
      state.data = data;
      render(data);
      return true;
    } catch (err) {
      const line = $("#updatedLine");
      if (line) {
        line.innerHTML = `상황판 데이터를 불러오지 못했어요 (<code>${esc(err.message)}</code>). ` +
          `웹 주소(https)로 열면 정상 동작합니다.`;
      }
      toast("데이터 로드 실패 — 잠시 후 새로고침 해주세요");
      return false;
    }
  }

  function formatUpdated(iso) {
    if (!iso) return "업데이트 시각 미상";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "업데이트 시각 미상";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).format(d) + " 기준";
  }

  /* ── 렌더링 ───────────────────────────────────────────── */
  function render(data) {
    const office = data.office || {};
    if (office.tagline) $("#brandTagline").textContent = office.tagline;
    if (office.motto) $("#motto").textContent = office.motto;
    const updated = $("#updatedLine");
    if (updated) updated.textContent = `${formatUpdated(office.updated)} · 자동 갱신은 없어요 (새로고침 버튼)`;

    if (office.note) $("#officeNote").textContent = office.note;

    renderBubbles(data.agents);
    renderSummary(data.agents);
    renderCards(data.agents);
    renderActivity(data.activity || []);
  }

  function renderBubbles(agents) {
    const list = $("#bubbleList");
    if (list) list.innerHTML = "";

    agents.forEach((agent) => {
      const id = agent.id;
      const group = document.querySelector(`[data-bubble="${id}"]`);
      const lines = Array.isArray(agent.bubble) ? agent.bubble : [String(agent.bubble || "")];

      if (group) {
        const c = agent.accent || agent.color || "#7c5cf0";
        const rect = $("rect", group);
        const tail = $("path", group);
        const name = $(".bubble-name", group);
        if (rect) rect.setAttribute("stroke", c);
        if (tail) tail.setAttribute("stroke", c);
        if (name) {
          name.textContent = agent.badge === "대장" ? `${agent.name} · 대장` : agent.name;
          name.setAttribute("fill", c);
        }
        $$("[data-bubble-line]", group).forEach((t, i) => {
          t.textContent = lines[i] || "";
          if (!lines[i]) t.setAttribute("opacity", "0");
        });
        group.setAttribute("aria-label", `${agent.name}: ${lines.join(" ")}`);
      }

      // 캐릭터 상태 클래스 + 후광 색
      const char = document.querySelector(`.agent[class*="agent--"]`);
      const wrap = document.querySelector(`.agent-hit[data-agent="${id}"] .agent`);
      if (wrap) {
        wrap.classList.toggle("is-working", agent.status === "작업중");
        wrap.classList.toggle("is-idle", agent.status !== "작업중");
        const halo = $(".halo", wrap);
        if (halo && agent.color) halo.setAttribute("fill", agent.color);
      }

      // 좁은 화면용 말풍선 목록
      if (list) {
        const li = document.createElement("li");
        li.dataset.agent = id;
        const color = agent.accent || "#7c5cf0";
        li.innerHTML = `<b style="color:${esc(color)}">${esc(agent.name)}</b><span>${esc(lines.join(" "))}</span>`;
        list.appendChild(li);
      }
    });
  }

  function renderSummary(agents) {
    const strip = $("#summaryStrip");
    if (!strip) return;
    const working = agents.filter((a) => a.status === "작업중").length;
    const idle = agents.filter((a) => a.status === "대기중").length;
    const doneCount = agents.reduce((n, a) => n + (a.recent ? a.recent.length : 0), 0);
    const total = agents.length;

    strip.innerHTML = `
      <span class="sum-item is-working"><span class="sum-num">${working}</span>가동 중</span>
      <span class="sum-item is-idle"><span class="sum-num">${idle}</span>대기 중</span>
      <span class="sum-item is-done"><span class="sum-num">${doneCount}</span>최근 완료</span>
      <span class="sum-item"><span class="sum-num">${total}</span>비서 인원</span>
    `;
  }

  function renderCards(agents) {
    const grid = $("#agentGrid");
    if (!grid) return;
    grid.innerHTML = agents.map((agent) => {
      const sCls = STATUS_CLASS[agent.status] || "idle";
      const tasks = (agent.current || []).map((t) => {
        const p = Math.max(0, Math.min(100, Number(t.progress) || 0));
        const tCls = STATUS_CLASS[t.state] || "idle";
        return `
          <li class="task">
            <div class="task-top">
              <span class="task-title">${esc(t.title)}</span>
              <span class="task-state task-state--${tCls}">${esc(t.state || "대기중")}</span>
            </div>
            <div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"
                 aria-label="${esc(t.title)} 진행률"><div class="bar-fill" style="width:${p}%"></div></div>
          </li>`;
      }).join("") || `<li class="task"><span class="task-title">배정된 작업 없음</span></li>`;

      const recent = (agent.recent || []).map((r) => `
        <li><span class="rt">${esc(r.title)}</span><span class="when">${esc(r.when || "")}</span></li>
      `).join("") || `<li><span class="rt">아직 완료 내역이 없어요</span></li>`;

      return `
        <article class="card" id="card-${esc(agent.id)}" data-agent="${esc(agent.id)}">
          <div class="card-head">
            <div class="avatar-wrap">
              <div class="avatar${agent.badge === "대장" ? " avatar--lead" : ""}" aria-hidden="true">
                <span class="smile"></span>
              </div>
              ${agent.badge === "대장" ? `<span class="avatar-crown" aria-hidden="true">👑</span>` : ""}
            </div>
            <div class="card-title">
              <div class="card-name">
                <strong>${esc(agent.name)}</strong>
                ${agent.badge ? `<span class="badge">${esc(agent.badge)}</span>` : ""}
              </div>
              <div class="card-role">${esc(agent.role || "")}</div>
            </div>
            <span class="status-pill status-pill--${sCls}">${esc(agent.status)}</span>
          </div>
          <p class="card-summary">${esc(agent.summary || "")}</p>
          <div class="task-block">
            <h4>진행 중</h4>
            <ul class="task-list">${tasks}</ul>
          </div>
          <div class="recent-block">
            <h4>최근 완료</h4>
            <ul class="recent-list">${recent}</ul>
          </div>
          <div class="card-foot">
            <button class="btn btn--ghost btn--sm pick-btn" type="button" data-pick="${esc(agent.id)}"
              data-mention-name="${esc(agent.name)}">지시 보내기 →</button>
          </div>
        </article>`;
    }).join("");
  }

  function renderActivity(items) {
    const list = $("#activityList");
    if (!list) return;
    list.innerHTML = items.map((a) => {
      const slug = a.agent === "알프1" ? "alf1" : a.agent === "알프2" ? "alf2" : a.agent === "알프3" ? "alf3" : "";
      return `<li>
        <span class="activity-agent activity-agent--${slug}">${esc(a.agent)}</span>
        <span class="activity-text">${esc(a.text)}</span>
        <span class="activity-when">${esc(a.when || "")}</span>
      </li>`;
    }).join("") || `<li><span class="activity-text">표시할 활동이 없어요</span></li>`;
  }

  /* ── 카메라 포커스: 캐릭터/카드 이동 ──────────────────── */
  function focusCard(id) {
    const card = document.getElementById(`card-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("is-picked");
    void card.offsetWidth;
    card.classList.add("is-picked");
    setTimeout(() => card.classList.remove("is-picked"), 1500);
  }

  /* ── 지시 작성기 ──────────────────────────────────────── */
  function initComposer() {
    const ta = $("#draft");
    const counter = $("#counter");
    const saveState = $("#saveState");
    if (!ta) return;

    // 초안 복원
    let saved = "";
    try { saved = localStorage.getItem(DRAFT_KEY) || ""; } catch { /* 저장소 차단 */ }
    if (saved.trim()) {
      ta.value = saved;
      updateCounter();
      setSaveState("초안 복원됨");
    }

    function updateCounter() {
      if (!counter) return;
      const n = ta.value.trim().length;
      counter.textContent = `${n.toLocaleString("ko-KR")}자`;
    }

    function setSaveState(text, savedNow = false) {
      if (!saveState) return;
      saveState.textContent = text;
      saveState.classList.toggle("is-saved", savedNow);
    }

    function saveDraft() {
      try {
        localStorage.setItem(DRAFT_KEY, ta.value);
        const t = new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false
        }).format(new Date());
        localStorage.setItem(DRAFT_TIME_KEY, t);
        setSaveState(`초안 저장됨 · ${t}`, true);
      } catch {
        setSaveState("저장 불가 (브라우저 설정)");
      }
    }

    ta.addEventListener("input", () => {
      updateCounter();
      const hint = $("#copyHint");
      if (hint && hint.textContent !== "복사한 뒤 채팅방에 Ctrl/⌘+V") {
        hint.textContent = "복사한 뒤 채팅방에 Ctrl/⌘+V";
      }
      setSaveState("저장 중…");
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(saveDraft, 500);
    });

    function insertAtCaret(text) {
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? ta.value.length;
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(end);
      const needSpace = before.length > 0 && !/\s$/.test(before);
      const chunk = (needSpace ? " " : "") + text;
      ta.value = before + chunk + after;
      const pos = before.length + chunk.length;
      ta.setSelectionRange(pos, pos);
      ta.focus();
      updateCounter();
      setSaveState("저장 중…");
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(saveDraft, 500);
    }

    $$(".mention").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.mention || "";
        if (name.includes(",")) {
          insertAtCaret(`@${name.split(",").map((s) => s.trim()).join(", @")} `);
        } else {
          insertAtCaret(`@${name} `);
        }
      });
    });

    $$(".chip[data-template]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const t = chip.dataset.template || "";
        if (!t) return;
        if (ta.value.includes(t)) { toast("이미 들어 있어요"); return; }
        const tail = ta.value && !/\s$/.test(ta.value) ? " " : "";
        ta.value = ta.value + tail + t;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        updateCounter();
        saveDraft();
      });
    });

    // 복사
    const copyBtn = $("#copyBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const text = ta.value.trim();
        if (!text) {
          toast("지시 내용을 먼저 적어 주세요");
          ta.focus();
          return;
        }
        let ok = false;
        try {
          await navigator.clipboard.writeText(ta.value);
          ok = true;
        } catch {
          try {
            ta.select();
            ok = document.execCommand("copy");
            ta.setSelectionRange(ta.value.length, ta.value.length);
          } catch { ok = false; }
        }
        if (ok) {
          toast("복사 완료! 채팅방에 붙여넣으세요 📋");
          const hint = $("#copyHint");
          if (hint) hint.textContent = "복사됨 ✓";
          saveDraft();
        } else {
          toast("자동 복사가 막혔어요 — 내용을 직접 선택해 주세요");
          ta.focus();
          ta.select();
        }
      });
    }

    // 지우기
    const clearBtn = $("#clearBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        ta.value = "";
        updateCounter();
        try {
          localStorage.removeItem(DRAFT_KEY);
          localStorage.removeItem(DRAFT_TIME_KEY);
        } catch { /* noop */ }
        setSaveState("지움");
        ta.focus();
        toast("초안을 비웠어요");
      });
    }
  }

  /* ── 이벤트 연결 ──────────────────────────────────────── */
  function initEvents() {
    // SVG 캐릭터
    $$(".agent-hit").forEach((el) => {
      const go = () => focusCard(el.dataset.agent);
      el.addEventListener("click", go);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          go();
        }
      });
    });

    // 카드의 "지시 보내기"
    document.addEventListener("click", (e) => {
      const pick = e.target.closest("[data-pick]");
      if (!pick) return;
      const name = pick.dataset.mentionName || "";
      const ta = $("#draft");
      const composer = $("#composer");
      if (ta && composer) {
        const before = ta.value;
        const needSpace = before.length > 0 && !/\s$/.test(before);
        ta.value = (needSpace ? before + " " : before) + `@${name} `;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        composer.scrollIntoView({ behavior: "smooth", block: "start" });
        toast(`${name}에게 보낼 지시를 적어 주세요`);
      }
    });

    // 새로고침
    const refresh = $("#refreshBtn");
    if (refresh) {
      refresh.addEventListener("click", async () => {
        const icon = $(".btn-icon", refresh);
        if (icon) {
          icon.style.transition = "transform .8s ease";
          icon.style.transform = "rotate(360deg)";
          setTimeout(() => { icon.style.transition = ""; icon.style.transform = ""; }, 850);
        }
        const ok = await loadOffice();
        if (ok) toast("상황판을 새로 불러왔어요");
      });
    }

    // 키보드: Esc로 토스트 닫기
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $("#toast")?.classList.remove("is-on");
    });
  }

  /* ── 시작 ─────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    tickClock();
    setInterval(tickClock, 1000);
    initComposer();
    initEvents();
    loadOffice();
  });
})();
