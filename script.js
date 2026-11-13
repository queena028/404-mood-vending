"use strict";

// 內容只來自 JSON；四個模組以登錄表分派，不依商品編號寫功能分支。
const moodNames = { tired: "有點累", sad: "不太開心", bored: "有點無聊", good: "心情不錯", unsure: "說不上來" };
const iconNames = new Set(["pause", "letter", "spark", "ticket", "mystery", "star", "moon"]);
const $ = (selector, root = document) => root.querySelector(selector);
const grid = $("#product-grid");
const dialog = $("#experience-dialog");
const dialogContent = $("#dialog-content");
let products = [];
let selectedMood = null;
let cleanupModule = null;
let dispatchTimeout = null;
let transactionVersion = 0;
let returnFocus = null;
let toastTimeout = null;
let clawIndex = 0;
let isGrabbing = false;
const collectionKey = "404-mood:collection:v1";
let collection = [];

function loadCollection() {
  try {
    const raw = localStorage.getItem(collectionKey);
    collection = raw === null ? [] : validateCollection(JSON.parse(raw));
  } catch {
    collection = [];
    $("#collection-status").textContent = "目前無法讀取收藏，可能是瀏覽器阻擋儲存或資料格式有誤。仍可夾娃娃與互動；重新收藏會嘗試建立新的收藏資料。";
  }
  renderCollection();
}

function validateCollection(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.items)) throw new Error("收藏格式不正確");
  const ids = new Set();
  data.items.forEach(item => {
    if (!item || typeof item.productId !== "string" || !/^MV-\d{3}$/.test(item.productId) || ids.has(item.productId) || typeof item.nickname !== "string" || !item.nickname.trim() || item.nickname.length > 24 || typeof item.collectedAt !== "string" || !Number.isFinite(Date.parse(item.collectedAt))) throw new Error("收藏項目不正確");
    ids.add(item.productId);
  });
  return data.items.map(item => ({ productId: item.productId, nickname: item.nickname.trim(), collectedAt: item.collectedAt }));
}

function renderCollection() {
  const shelf = $("#collection-grid");
  shelf.replaceChildren();
  const available = collection.filter(item => products.some(product => product.id === item.productId && product.interactionType !== "mystery"));
  $("#collection-count").textContent = String(available.length);
  if (!available.length) shelf.append(element("p", "collection-empty", "小架子還空著。夾到娃娃後，幫它取個名字，再收藏到這裡吧。♡"));
  available.forEach(item => {
    const product = products.find(product => product.id === item.productId);
    const card = button("", "collection-card", () => showCollectedCompanion(product, card));
    card.dataset.collectionId = product.id;
    if (returnFocus?.dataset.collectionId === product.id) returnFocus = card;
    card.setAttribute("aria-label", `探望${item.nickname}，${product.name}`);
    card.append(createPlush(product), element("strong", "collection-nickname", item.nickname), element("span", "", product.name), element("small", "", "點我，來陪你一下 ↗"));
    shelf.append(card);
  });
}

function createCollectionEditor(product) {
  const form = element("form", "collection-editor");
  const label = element("label", "field-label", "幫這位小夥伴取個名字");
  label.htmlFor = "companion-name";
  const input = element("input", "nickname-input");
  input.id = "companion-name";
  input.type = "text";
  input.maxLength = 24;
  input.autocomplete = "off";
  const existing = collection.find(item => item.productId === product.id);
  input.value = existing?.nickname || "";
  input.placeholder = "例如：小月亮（最多 24 字）";
  const save = element("button", "secondary-button", existing ? "更新名字" : "收藏到小架子 ♡");
  save.type = "submit";
  form.append(label, input, save, element("p", "fine-print", "按下收藏才會儲存；同一種娃娃會留在同一個位置。"));
  const feedback = createFeedback(form);
  form.addEventListener("submit", event => {
    event.preventDefault();
    const nickname = input.value.trim();
    if (!nickname || nickname.length > 24) { feedback("請取一個 1～24 字的名字。", true); input.focus(); return; }
    const previous = collection.find(item => item.productId === product.id);
    const entry = { productId: product.id, nickname, collectedAt: previous?.collectedAt || new Date().toISOString() };
    const next = previous ? collection.map(item => item.productId === product.id ? entry : item) : [...collection, entry];
    try {
      localStorage.setItem(collectionKey, JSON.stringify({ version: 1, items: next }));
      collection = next;
      renderCollection();
      input.value = nickname;
      save.textContent = "更新名字";
      if (form.parentNode?.classList.contains("collected-view")) $("#dialog-title").textContent = nickname;
      feedback(`「${nickname}」已在收藏架上等你了。`);
      $("#collection-status").textContent = "收藏已儲存在這個瀏覽器；清除網站資料或換裝置後不會保留。";
    } catch { feedback("瀏覽器未允許儲存，名字與收藏尚未保存。你仍可繼續抱抱或開始體驗。", true); }
  });
  return form;
}

function showCollectedCompanion(product, trigger) {
  returnFocus = trigger;
  const entry = collection.find(item => item.productId === product.id);
  const view = element("section", "collected-view");
  view.append(element("p", "dialog-eyebrow", "WELCOME BACK, LITTLE FRIEND"), dialogTitle(entry.nickname), element("p", "dialog-description", `${product.name} · ${new Date(entry.collectedAt).toLocaleDateString("zh-TW")} 起陪著你`), createCompanion(product), createCollectionEditor(product), element("p", "collection-paper", product.receiptMessage), button("一起開始體驗 →", "primary-button full-width", () => showInteraction(product)), button("回到收藏架", "text-button module-return", closeDialog));
  setDialog(view);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, onClick) {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function icon(name, className = "product-icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `./assets/icons.svg#${name}`);
  svg.append(use);
  return svg;
}

function setProductColor(node, product) {
  node.style.setProperty("--product-color", product.color);
}

// 娃娃與紙條都是共用元件；新增商品只需要填寫既有 JSON 欄位。
function createPlush(product) {
  const plush = element("span", "plush");
  plush.setAttribute("aria-hidden", "true");
  setProductColor(plush, product);
  ["ear-left", "ear-right", "arm-left", "arm-right", "foot-left", "foot-right"].forEach(part => plush.append(element("span", `plush-part ${part}`)));
  const body = element("span", "plush-body");
  const face = element("span", "plush-face");
  face.append(element("span", "eye eye-left"), element("span", "eye eye-right"), element("span", "plush-mouth"));
  body.append(face, icon(product.icon, "plush-patch"));
  plush.append(body);
  return plush;
}

function createCompanion(product, compact = false) {
  const panel = element("div", `companion-panel${compact ? " is-compact" : ""}`);
  const replies = [product.receiptMessage, product.effect, product.sideEffect];
  let replyIndex = 0;
  let hugAnimation = null;
  const message = element("p", "companion-message", compact ? "我在這裡，陪你慢慢來。" : "嗨，現在換我陪你。想抱一下嗎？");
  message.setAttribute("role", "status");
  const plush = createPlush(product);
  const hug = button("", "companion-hug", () => {
    message.textContent = replies[replyIndex++ % replies.length];
    hugAnimation?.cancel();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hugAnimation = plush.animate?.([
        { transform: "rotate(0) scale(1)" },
        { transform: "rotate(-9deg) scale(1.08)" },
        { transform: "rotate(8deg) scale(1.04)" },
        { transform: "rotate(-4deg) scale(1.02)" },
        { transform: "rotate(0) scale(1)" }
      ], { duration: 650, easing: "ease-in-out" });
    }
  });
  hug.setAttribute("aria-label", `抱抱${product.name}，聽一句暖心的話`);
  hug.append(plush, element("span", "companion-hint", "點我，抱一下 ♡"));
  const words = element("div", "companion-words");
  words.append(element("span", "companion-kicker", compact ? "YOUR LITTLE COMPANION" : "TAKE YOUR TIME. I'M HERE."), message);
  if (!compact) words.append(element("p", "companion-stay", "不用急著離開，我會待到你準備好。"));
  panel.append(hug, words);
  return panel;
}

function setClawBusy(busy) {
  isGrabbing = busy;
  $("#grab-button").disabled = busy || !products.length;
  $("#move-left").disabled = busy || products.length < 2;
  $("#move-right").disabled = busy || products.length < 2;
  $("#cancel-grab").hidden = !busy;
  document.querySelectorAll("[data-mood], #skip-mood, .toy-card").forEach(node => { node.disabled = busy; });
  $("#claw-playfield").setAttribute("aria-busy", String(busy));
}

function updateClaw(scrollToTarget = false) {
  if (!products.length) return;
  clawIndex = Math.max(0, Math.min(clawIndex, products.length - 1));
  const product = products[clawIndex];
  const cards = [...grid.querySelectorAll(".toy-card")];
  cards.forEach((card, index) => card.classList.toggle("is-targeted", index === clawIndex));
  const target = cards[clawIndex];
  if (!target) return;
  const plush = $(".plush", target);
  const innerRect = $("#claw-inner").getBoundingClientRect();
  const plushRect = plush.getBoundingClientRect();
  const x = plushRect.left - innerRect.left + plushRect.width / 2;
  $("#claw-carriage").style.left = `${x}px`;
  $("#target-name").textContent = product.name;
  $("#target-price").textContent = `紙條上的代價：${product.price}`;
  if (scrollToTarget) {
    const playfield = $("#claw-playfield");
    playfield.scrollTo({ left: Math.max(0, x - playfield.clientWidth / 2 + 35), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
}

function moveClaw(direction) {
  if (isGrabbing || !products.length) return;
  clawIndex = (clawIndex + direction + products.length) % products.length;
  updateClaw(true);
}

function grabSelected() {
  if (isGrabbing || !products.length || dialog.open) return;
  returnFocus = $("#grab-button");
  dispense(products[clawIndex]);
}

function requireText(object, keys, context) {
  keys.forEach(key => {
    if (typeof object[key] !== "string" || !object[key].trim()) throw new Error(`${context}：${key} 必須是非空文字`);
  });
}

function requireInteger(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} 的數值超出規範`);
}

function requireList(value, label) {
  if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} 必須是非空文字陣列`);
  }
}

function validateProducts(data) {
  if (!Array.isArray(data) || !data.length) throw new Error("商品資料必須是非空陣列");
  const ids = new Set();
  data.forEach(product => {
    if (!product || typeof product !== "object" || Array.isArray(product)) throw new Error("商品格式不正確");
    requireText(product, ["id", "name", "category", "price", "description", "effect", "sideEffect", "receiptMessage", "icon", "color", "interactionType"], "商品");
    if (!/^MV-\d{3}$/.test(product.id) || ids.has(product.id)) throw new Error("商品編號格式錯誤或重複");
    ids.add(product.id);
    if (!/^#[0-9a-f]{6}$/i.test(product.color) || !iconNames.has(product.icon)) throw new Error(`${product.id}：顏色或圖示不符合規範`);
    requireList(product.recommendedMoods, `${product.id} 的心情`);
    if (product.recommendedMoods.some(mood => !Object.hasOwn(moodNames, mood))) throw new Error(`${product.id}：心情鍵錯誤`);
    const config = product.interactionConfig;
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error(`${product.id}：缺少互動設定`);
    switch (product.interactionType) {
      case "timer":
        requireText(config, ["intro", "completionMessage"], product.id);
        requireInteger(config.durationSeconds, 1, 86400, "計時秒數");
        break;
      case "journal":
        requireText(config, ["prompt", "placeholder", "responseMessage"], product.id);
        requireInteger(config.maxLength, 1, 10000, "書寫字數");
        break;
      case "random":
        requireText(config, ["intro", "buttonLabel"], product.id);
        requireList(config.tasks, "挑戰內容");
        break;
      case "card":
        requireText(config, ["prompt", "placeholder", "cardTitle", "footer"], product.id);
        requireInteger(config.maxLength, 1, 500, "卡片字數");
        break;
      case "mystery":
        requireText(config, ["revealMessage"], product.id);
        requireList(config.candidateIds, "盲盒候選商品");
        if (new Set(config.candidateIds).size !== config.candidateIds.length) throw new Error("盲盒候選商品重複");
        break;
      default:
        throw new Error(`${product.id}：未知的互動類型`);
    }
  });
  data.filter(product => product.interactionType === "mystery").forEach(product => {
    product.interactionConfig.candidateIds.forEach(id => {
      const target = data.find(candidate => candidate.id === id);
      if (!target || target.interactionType === "mystery") throw new Error("盲盒必須引用既有的非盲盒商品");
    });
  });
  return data;
}

async function loadProducts() {
  $("#load-error").hidden = true;
  grid.replaceChildren(element("p", "loading-text", "正在補充今晚的溫柔…"));
  $("#retry-load").disabled = true;
  try {
    const response = await fetch("./data/products.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`讀取商品失敗（HTTP ${response.status}）`);
    products = validateProducts(await response.json());
    $("#product-count").textContent = `${String(products.length).padStart(2, "0")} LITTLE COMPANIONS`;
    renderProducts();
    loadCollection();
    setClawBusy(false);
  } catch (error) {
    products = [];
    setClawBusy(false);
    grid.replaceChildren();
    $("#product-count").textContent = "娃娃們暫時休息中";
    $("#load-error-message").textContent = `今晚的商品暫時連不上。請確認使用 HTTP Server，並檢查 data/products.json。${error.message}`;
    $("#load-error").hidden = false;
  } finally {
    $("#retry-load").disabled = false;
  }
}

function renderProducts() {
  grid.replaceChildren();
  $("#claw-inner").style.setProperty("--toy-count", products.length);
  const matches = products.filter(product => selectedMood && product.recommendedMoods.includes(selectedMood));
  $("#recommendation").textContent = !selectedMood ? "不急著選，先看看娃娃旁的小紙條。" : matches.length ? `給「${moodNames[selectedMood]}」的你，${matches.length} 隻娃娃正在向你揮手 ✦` : "暫時沒有專屬推薦，但每隻娃娃都可以帶回家。";
  $("#lcd-message").textContent = selectedMood ? ({ tired: "今天辛苦了，休息一下吧。", sad: "不開心也可以被接住。", bored: "來一點意料之外的驚喜？", good: "把今天的好事，收藏起來。", unsure: "不知道也沒關係，慢慢來。" })[selectedMood] : "你已經做得很好了。";
  products.forEach((product, index) => {
    const recommended = matches.includes(product);
    const card = button("", `toy-card${recommended ? " is-recommended" : ""}`, () => {
      if (isGrabbing) return;
      clawIndex = index;
      updateClaw(true);
      showProduct(product, card);
    });
    card.dataset.productId = product.id;
    card.setAttribute("aria-label", `${product.id} ${product.name}，代價：${product.price}${recommended ? "，心情推薦" : ""}。查看詳細資訊`);
    setProductColor(card, product);
    const note = element("span", "toy-note");
    note.append(element("span", "note-id", product.id), element("span", "note-name", product.name), element("span", "note-description", product.description), element("span", "note-price", `♡ ${product.price}`));
    card.append(element("span", "toy-badge", recommended ? "✦ 想抱抱你" : product.category), createPlush(product), note, element("span", "toy-pedestal", ""));
    grid.append(card);
  });
  updateClaw(false);
}

function chooseMood(mood) {
  if (isGrabbing) return;
  selectedMood = mood;
  document.querySelectorAll("[data-mood]").forEach(node => node.setAttribute("aria-pressed", String(node.dataset.mood === mood)));
  if (products.length) renderProducts();
}

function disposeModule() {
  if (cleanupModule) cleanupModule();
  cleanupModule = null;
}

function setDialog(view) {
  disposeModule();
  dialogContent.replaceChildren(view);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  const title = $("#dialog-title", view);
  if (title) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}

function dialogTitle(text) {
  const title = element("h2", "dialog-title", text);
  title.id = "dialog-title";
  return title;
}

function cancelTransaction() {
  transactionVersion += 1;
  clearTimeout(dispatchTimeout);
  dispatchTimeout = null;
  resetClawAnimation();
  setClawBusy(false);
}

function resetClawAnimation() {
  $("#claw-machine").classList.remove("is-grabbing");
  $("#claw-prize").replaceChildren();
  grid.querySelectorAll(".is-caught").forEach(node => node.classList.remove("is-caught"));
  $("#collection-slot").classList.remove("is-dispensing");
  $("#collection-slot").querySelectorAll(".slot-product").forEach(node => node.remove());
}

function closeDialog() {
  cancelTransaction();
  disposeModule();
  dialog.close();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

function showProduct(product, trigger) {
  returnFocus = trigger;
  const view = element("section", "product-detail");
  setProductColor(view, product);
  const meta = element("div", "detail-meta");
  meta.append(element("span", "mono", product.id), element("span", "", product.category));
  const plushPreview = element("div", "detail-plush");
  plushPreview.append(createPlush(product));
  view.append(plushPreview, meta, dialogTitle(product.name), element("p", "dialog-description", product.description));
  const list = element("dl", "detail-list");
  [["支付代價", product.price], ["商品效果", product.effect], ["可愛副作用", product.sideEffect]].forEach(([label, value]) => list.append(element("dt", "", label), element("dd", "", value)));
  view.append(list, button("把這隻娃娃夾回家 ↓", "primary-button full-width", () => dispense(product)), element("p", "fine-print", "每次都會夾到，不用投幣。娃娃會帶著這張小紙條陪你回家。"));
  setDialog(view);
}

function dispense(sourceProduct) {
  if (isGrabbing || !products.length) return;
  const candidates = sourceProduct.interactionConfig.candidateIds;
  const product = sourceProduct.interactionType === "mystery" ? products.find(candidate => candidate.id === candidates[Math.floor(Math.random() * candidates.length)]) : sourceProduct;
  const version = ++transactionVersion;
  clawIndex = products.indexOf(sourceProduct);
  updateClaw(true);
  setClawBusy(true);
  disposeModule();
  if (dialog.open) dialog.close();
  $("#claw-machine").classList.add("is-grabbing");
  const target = [...grid.querySelectorAll(".toy-card")][clawIndex];
  target.classList.add("is-caught");
  $("#claw-prize").append(createPlush(sourceProduct));
  $("#grab-status").textContent = `夾爪正在接住「${sourceProduct.name}」… 你的溫柔正在路上。`;
  $("#claw-machine").scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  const slot = $("#collection-slot");
  slot.classList.add("is-dispensing");
  const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 2500;
  dispatchTimeout = setTimeout(() => {
    if (version !== transactionVersion || !isGrabbing) return;
    dispatchTimeout = null;
    resetClawAnimation();
    setClawBusy(false);
    $("#grab-status").textContent = `夾到了！「${product.name}」和它的小紙條，現在都屬於你。`;
    showReceipt(product, sourceProduct);
  }, delay);
}

function receiptText(product, source, date) {
  return ["404 MOOD VENDING MACHINE", "404 心情販賣所", `日期：${date}`, ...(source.interactionType === "mystery" ? [`來源：${source.name} → ${product.name}`] : []), `商品編號：${product.id}`, `商品名稱：${product.name}`, `支付代價：${product.price}`, `商品效果：${product.effect}`, `專屬訊息：${product.receiptMessage}`, "實際付款：NT$ 0", "THANK YOU FOR TAKING CARE OF YOURSELF."].join("\n");
}

function showReceipt(product, source) {
  const view = element("section", "receipt-view");
  const date = new Date().toLocaleString("zh-TW", { hour12: false });
  view.append(element("p", "dialog-eyebrow", "ONE LITTLE COMPANION, CAUGHT."), dialogTitle("夾到了！這份溫柔給你"));
  if (source.interactionType === "mystery") view.append(element("p", "reveal-note", `${source.interactionConfig.revealMessage}抽中了「${product.name}」。`));
  view.append(createCompanion(product), createCollectionEditor(product));
  const receipt = element("article", "receipt");
  receipt.append(element("p", "receipt-header", "404 MOOD VENDING MACHINE"), element("p", "receipt-shop", "— 心 情 販 賣 所 —"), element("hr", "receipt-divider"));
  const list = element("dl");
  const rows = [["商品編號", product.id], ["商品名稱", product.name], ["支付代價", product.price], ["商品效果", product.effect], ["實際付款", "NT$ 0"]];
  if (source.interactionType === "mystery") rows.unshift(["領取來源", "神祕盲盒"]);
  rows.forEach(([label, value]) => list.append(element("dt", "", label), element("dd", "", value)));
  const barcode = element("div", "barcode");
  barcode.setAttribute("aria-hidden", "true");
  receipt.append(list, element("hr", "receipt-divider"), element("p", "receipt-message", `「${product.receiptMessage}」`), element("hr", "receipt-divider"), element("p", "receipt-footer", date), barcode, element("p", "receipt-footer", "THANK YOU FOR BEING YOU."));
  const actions = element("div", "button-row");
  actions.append(button("複製收據", "secondary-button", event => copyText(receiptText(product, source, date), view, event.currentTarget)), button("開始體驗 →", "primary-button", () => showInteraction(product)));
  const paper = element("details", "companion-receipt");
  paper.append(element("summary", "", "展開娃娃帶來的小紙條收據"), receipt);
  view.append(paper, actions, button("先收好，返回夾娃娃機", "text-button receipt-return", closeDialog));
  setDialog(view);
}

function toast(message) {
  clearTimeout(toastTimeout);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimeout = setTimeout(() => { $("#toast").hidden = true; }, 2600);
}

async function copyText(text, container, trigger) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    trigger.textContent = "已複製 ✓";
    toast("已複製，帶走這一點溫柔。");
  } catch {
    container.querySelector(".copy-fallback")?.remove();
    const fallback = element("div", "copy-fallback");
    fallback.append(element("p", "", "瀏覽器未允許自動複製。請選取下方文字後手動複製。"));
    const field = element("textarea", "text-input");
    field.value = text;
    field.readOnly = true;
    field.setAttribute("aria-label", "可手動複製的文字");
    fallback.append(field);
    container.append(fallback);
    field.focus();
    field.select();
  }
}

function showInteraction(product) {
  const view = element("section", "module-view");
  const header = element("header", "module-header");
  header.append(element("p", "module-label", `${product.id} / ${product.category}`), dialogTitle(product.name), element("p", "dialog-description", product.description));
  const body = element("div", "module-body");
  view.append(header, createCompanion(product, true), body, button("← 返回夾娃娃機", "text-button module-return", closeDialog));
  setDialog(view);
  cleanupModule = interactionModules[product.interactionType](body, product);
}

function createFeedback(container) {
  const feedback = element("p", "module-feedback");
  feedback.setAttribute("role", "status");
  container.append(feedback);
  return (message, isError = false) => {
    feedback.textContent = message;
    feedback.classList.toggle("is-error", isError);
  };
}

function createTextField(config, id, labelText) {
  const group = element("div");
  const label = element("label", "field-label", labelText);
  label.htmlFor = id;
  const input = element("textarea", "text-input");
  input.id = id;
  input.placeholder = config.placeholder;
  input.maxLength = config.maxLength;
  const meta = element("div", "input-meta");
  const counter = element("span", "", `0 / ${config.maxLength}`);
  meta.append(element("span", "", "每個字，都可以慢慢來。"), counter);
  const updateCounter = () => { counter.textContent = `${input.value.length} / ${config.maxLength}`; };
  input.addEventListener("input", updateCounter);
  group.append(label, input, meta);
  return { group, input, updateCounter };
}

const interactionModules = {
  timer(container, product) {
    const config = product.interactionConfig;
    const durationMs = config.durationSeconds * 1000;
    let remainingMs = durationMs;
    let deadline = 0;
    let interval = null;
    let completed = false;
    container.append(element("p", "module-message", config.intro));
    const circle = element("div", "timer-circle");
    const inner = element("div");
    const time = element("div", "timer-time");
    time.setAttribute("role", "timer");
    time.setAttribute("aria-label", "剩餘休息時間");
    const state = element("p", "timer-state", "給自己，一點空白");
    inner.append(time, state);
    circle.append(inner);
    const actions = element("div", "button-row");
    const message = element("p", "module-message");
    message.setAttribute("role", "status");
    message.style.marginTop = "20px";
    function stop() { clearInterval(interval); interval = null; }
    function update() {
      const seconds = Math.ceil(remainingMs / 1000);
      time.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      circle.style.setProperty("--timer-progress", `${remainingMs / durationMs * 100}%`);
      start.disabled = interval !== null || remainingMs <= 0;
      pause.disabled = interval === null;
    }
    function tick() {
      remainingMs = Math.max(0, deadline - Date.now());
      if (remainingMs === 0) {
        stop();
        if (!completed) {
          completed = true;
          state.textContent = "歡迎慢慢回來";
          message.textContent = config.completionMessage;
          message.classList.add("is-complete");
        }
      }
      update();
    }
    const start = button("開始休息", "primary-button", () => {
      if (interval !== null || remainingMs <= 0) return;
      deadline = Date.now() + remainingMs;
      interval = setInterval(tick, 150);
      state.textContent = "此刻，不用趕路";
      tick();
    });
    const pause = button("暫停", "secondary-button", () => {
      if (interval === null) return;
      tick();
      stop();
      if (!completed) state.textContent = "停在這裡，也沒關係";
      update();
    });
    const reset = button("重設", "secondary-button", () => {
      stop();
      remainingMs = durationMs;
      completed = false;
      message.textContent = "";
      message.classList.remove("is-complete");
      state.textContent = "給自己，一點空白";
      update();
    });
    actions.append(start, pause, reset);
    container.append(circle, actions, message);
    update();
    return stop;
  },

  journal(container, product) {
    const config = product.interactionConfig;
    const storageKey = `404-mood:journal:${product.id}`;
    const form = element("form");
    const { group, input, updateCounter } = createTextField(config, "journal-text", config.prompt);
    const choice = element("label", "save-choice");
    const checkbox = element("input");
    checkbox.type = "checkbox";
    choice.append(checkbox, element("span", "", "我想把內容儲存在這個瀏覽器，下次再回來看。"));
    const actions = element("div", "button-row");
    const submit = element("button", "primary-button", "把心事放在這裡");
    submit.type = "submit";
    actions.append(button("清空內容", "secondary-button", () => {
      input.value = "";
      updateCounter();
      checkbox.checked = false;
      try { localStorage.removeItem(storageKey); feedback("已清空內容，也刪除了這件商品的本機存稿。"); }
      catch { feedback("畫面內容已清空，但瀏覽器阻擋存取，無法確認本機存稿是否已刪除。", true); }
      input.focus();
    }), submit);
    form.append(group, choice, element("p", "privacy-note", "不勾選就不儲存。文字只在本機處理，不會上傳；共用裝置上請留意保存的內容。"), actions);
    container.append(form);
    const feedback = createFeedback(container);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        input.value = saved.slice(0, config.maxLength);
        checkbox.checked = true;
        updateCounter();
        feedback("已讀取你先前主動儲存在這個瀏覽器的文字。");
      }
    } catch { feedback("瀏覽器未允許本機儲存，你仍然可以安心書寫；內容只會暫留在這個畫面。", true); }
    checkbox.addEventListener("change", () => {
      if (!checkbox.checked) {
        try { localStorage.removeItem(storageKey); feedback("已取消保存並刪除本機存稿；畫面文字仍在。"); }
        catch { feedback("瀏覽器阻擋存取，無法確認先前存稿是否已刪除。", true); }
      } else feedback("按下「把心事放在這裡」後，才會儲存目前文字。");
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!input.value.trim()) { feedback("可以先寫下一個字，也可以等準備好了再回來。", true); input.focus(); return; }
      if (checkbox.checked) {
        try { localStorage.setItem(storageKey, input.value); }
        catch { feedback(`${config.responseMessage}\n但瀏覽器未允許保存，這份文字尚未儲存。`, true); return; }
      }
      feedback(`${config.responseMessage}\n${checkbox.checked ? "已儲存在這個瀏覽器。" : "沒有儲存；關閉視窗後，這份文字就會離開。"}`);
    });
    return () => {};
  },

  random(container, product) {
    const config = product.interactionConfig;
    let previousIndex = -1;
    container.append(element("p", "module-message", config.intro));
    const card = element("div", "challenge-card");
    const task = element("p", "challenge-task");
    task.setAttribute("role", "status");
    card.append(element("p", "challenge-star", "✷"), element("p", "challenge-label", "YOUR LITTLE ADVENTURE"), task, element("p", "challenge-foot", "不必打卡，也不必證明。開心就好。"));
    function draw() {
      const choices = config.tasks.map((_, index) => index).filter(index => config.tasks.length === 1 || index !== previousIndex);
      previousIndex = choices[Math.floor(Math.random() * choices.length)];
      task.textContent = config.tasks[previousIndex];
    }
    container.append(card, button(config.buttonLabel, "primary-button full-width", draw));
    draw();
    return () => {};
  },

  card(container, product) {
    const config = product.interactionConfig;
    const form = element("form");
    const { group, input } = createTextField(config, "card-text", config.prompt);
    const submit = element("button", "primary-button full-width", "製作我的快樂紀念卡 ✦");
    submit.type = "submit";
    form.append(group, submit);
    const preview = element("div");
    preview.hidden = true;
    container.append(form, preview);
    const feedback = createFeedback(container);
    form.addEventListener("submit", event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) { feedback("先留下一件小事，再把這一刻印下來。", true); input.focus(); return; }
      feedback("");
      const date = new Date().toLocaleDateString("zh-TW");
      const card = element("article", "memory-card");
      card.append(element("p", "memory-kicker", "404 / A MOMENT TO KEEP"), element("h3", "memory-title", config.cardTitle), element("p", "memory-text", text), element("p", "memory-date", date), element("p", "memory-footer", config.footer));
      card.tabIndex = -1;
      const actions = element("div", "button-row");
      actions.append(button("重新製作", "secondary-button", () => { preview.hidden = true; preview.replaceChildren(); form.hidden = false; input.focus(); }), button("複製紀念卡文字", "primary-button", event => copyText(`${config.cardTitle}\n${text}\n${date}\n${config.footer}\n— 404 心情販賣所`, preview, event.currentTarget)));
      preview.replaceChildren(card, actions);
      form.hidden = true;
      preview.hidden = false;
      card.focus({ preventScroll: true });
    });
    return () => {};
  }
};

document.querySelectorAll("[data-mood]").forEach(node => node.addEventListener("click", () => chooseMood(node.dataset.mood)));
$("#skip-mood").addEventListener("click", () => {
  chooseMood(null);
  $("#vending").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
});
$("#retry-load").addEventListener("click", loadProducts);
$("#move-left").addEventListener("click", () => moveClaw(-1));
$("#move-right").addEventListener("click", () => moveClaw(1));
$("#grab-button").addEventListener("click", grabSelected);
$("#cancel-grab").addEventListener("click", () => {
  cancelTransaction();
  $("#grab-status").textContent = "已取消抓取。娃娃們會在這裡，等你準備好再來。";
  $("#grab-button").focus({ preventScroll: true });
});
$("#claw-playfield").addEventListener("keydown", event => {
  if (event.target !== event.currentTarget || isGrabbing) return;
  if (["ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    if (event.key === "ArrowLeft") moveClaw(-1);
    else if (event.key === "ArrowRight") moveClaw(1);
    else grabSelected();
  }
});
window.addEventListener("resize", () => updateClaw(false));
$("#close-dialog").addEventListener("click", closeDialog);
dialog.addEventListener("cancel", event => { event.preventDefault(); closeDialog(); });
dialog.addEventListener("close", () => { if (!isGrabbing) cancelTransaction(); disposeModule(); });
dialog.addEventListener("click", event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
});
$("#year").textContent = new Date().getFullYear();
loadProducts();
