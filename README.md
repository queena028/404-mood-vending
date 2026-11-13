# 404 心情販賣所

> 買不到快樂，但可以領取一點小確幸。

一台販售「不存在的商品」的深夜心情夾娃娃機。每隻娃娃旁邊，都有一張記錄商品名稱、說明與代價的小紙條。用一次深呼吸、一點坦白或一小撮好奇心，把娃娃和一份休息、書寫、小冒險或快樂紀念卡帶回家。沒有真實付款、登入或後端。

## 網站功能
- 五種心情推薦：適合的娃娃會亮起推薦標籤，也能跳過並自由瀏覽。
- 左右按鈕移動夾爪，按「夾一下」抓取目前目標；每次都會夾到，不用投幣。手機可水平滑動遊戲區看其他娃娃。
- 點娃娃可先讀取詳細資料，再決定是否抓取；每隻娃娃旁的小紙條直接顯示名稱、代價與簡短說明。
- JSON 驅動的 CSS 娃娃、紙條、抓取動畫、復古收據與文字複製；抓取中可取消。
- 夾到後娃娃會留在畫面，點娃娃可以抱抱、聽暖心回應；自行展開小紙條收據或開始體驗，沒有自動離場倒數。四種體驗中也有精簡陪伴娃娃。
- 夾到後可命名並按「收藏到小架子」，頁面下方收藏架可以探望、抱抱、改名與再次進入體驗。同一種娃娃收藏一次，重複保存更新名字；只在目前瀏覽器保存，不同步到其他裝置，也不包含書寫內容。初始五隻娃娃分別為冰藍、粉紅、奶油黃、紫色與薄荷綠。
- **timer**：設定式倒數、開始、暫停、重設、完成訊息。
- **journal**：書寫與回應；預設不存檔，主動勾選並送出後才儲存於 localStorage；可取消保存或清空。
- **random**：從 JSON 抽取挑戰，多項任務時避免連續重複。
- **card**：把一件開心的小事做成紀念卡，可複製與重新製作。
- 神祕盲盒：隨機挑選前四件商品，再接入既有模組。
- 桌機與手機的響應式 CSS、鍵盤焦點、減少動畫偏好、載入失敗重試。

## 使用技術
HTML5、CSS3、Vanilla JavaScript、JSON，以及本機 SVG 圖示。不需安裝 npm 套件、編譯、API Key 或付費服務。Python 只用來在開發時提供靜態檔案，不是網站後端；正式網站可直接部署到 GitHub Pages。

## 專案結構
```text
404-mood-vending/
├── AGENTS.md
├── README.md
├── TESTING.md
├── .nojekyll
├── index.html
├── style.css
├── script.js
├── data/
│   └── products.json
└── assets/
    ├── icons.svg
    └── favicon.svg
```

## 在 VSCode 中啟動
1. 用 VSCode「檔案 → 開啟資料夾」開啟這個 `404-mood-vending` 資料夾，確認能直接看到 `index.html` 與 `AGENTS.md`。
2. 選擇「終端機 → 新增終端機」。
3. 在專案目錄執行：
   ```powershell
   python -m http.server 5500 --bind 127.0.0.1
   ```
4. 保持終端機開著，在 Chrome 開啟 `http://127.0.0.1:5500/`。
5. 修改檔案後儲存，再重新整理瀏覽器。停止伺服器請回終端機按 `Ctrl+C`。

如果 `python` 指令不存在，這台電腦已找到的 Python 3.11 可使用：
```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe" -m http.server 5500 --bind 127.0.0.1
```

如果顯示連接埠被占用，將 `5500` 改為 `5501`，網址也改成相同數字。若首頁出現檔案清單，代表伺服器開在上層目錄；先停止伺服器，切換至本專案再重新執行。不要直接雙擊 HTML 使用 `file://`，否則 JSON fetch 可能失敗。

### 測試 GitHub Pages 子路徑
在 `404-mood-vending` 的上一層啟動相同指令，開啟 `http://127.0.0.1:5500/404-mood-vending/`。首頁、JSON、CSS、JS 和 SVG 都應正常載入。所有資源已採相對路徑。

## 如何新增商品
**先閱讀 AGENTS.md，再查看現有 products.json。**

優先選用既有模組，只在 `data/products.json` 陣列最後新增一個商品，不必修改 HTML、CSS 或 JavaScript。例如在初始五件商品之後加入：
```json
{
  "id": "MV-006",
  "name": "一分鐘的月光",
  "category": "時間罐頭",
  "price": "放鬆一次肩膀",
  "description": "借一分鐘，讓月光陪你發個呆。",
  "effect": "獲得六十秒，不必急著回答任何人。",
  "sideEffect": "呼吸可能會偷偷變得柔軟。",
  "receiptMessage": "慢一點，也能抵達明天。",
  "icon": "moon",
  "color": "#80DEE6",
  "interactionType": "timer",
  "interactionConfig": {
    "durationSeconds": 60,
    "intro": "把肩膀放下來，讓呼吸走慢一點。",
    "completionMessage": "月光已送達，歡迎慢慢回來。"
  },
  "recommendedMoods": ["tired", "unsure"]
}
```

注意前一件商品結尾需要逗號；最後一件不加尾逗號。編號必須唯一。四種 interactionConfig、可用心情與圖示的完整契約都在 AGENTS.md。新增一般商品會自動生成娃娃與旁邊的紙條；`color` 控制娃娃配色、`icon` 成為肚子上的圖案，機台會隨數量擴展水平遊戲區。若也希望盲盒抽到它，再把新 id 加進盲盒的 `candidateIds`。需要全新互動類型時，才擴充通用模組並同步更新指南。

## 上傳 GitHub 並部署 GitHub Pages
以下是操作步驟；本次沒有替你執行 Git push 或發布。

1. 在 GitHub 建立公開倉庫，例如 `404-mood-vending`。
2. 選「Add file → Upload files」，上傳本專案的**內容**。倉庫根目錄應直接看到 `index.html`、`style.css`、`script.js`、`data/` 與 `assets/`，不要再包一層 `404-mood-vending/`。提交檔案。
3. 進入倉庫的「Settings → Pages」。
4. 在「Build and deployment」選「Deploy from a branch」，選擇存放網站的分支（通常是 `main`）與 `/(root)`，按「Save」。
5. 等待 Pages 部署完成，按「Visit site」。網址通常是 `https://你的帳號.github.io/404-mood-vending/`。
6. 開啟實際網址，再依 TESTING.md 驗收。更新檔案並提交後，Pages 會重新部署。

不需要 Node.js、資料庫或伺服器端程式。`.nojekyll` 可隨專案一併提交。完整部署依據：[GitHub 官方建立 Pages 網站說明](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)、[設定發布來源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 隱私與測試
商品與圖示均來自本機靜態檔案。書寫內容不會上傳，不會寫入 console；journal 的主動保存與命名收藏會分別使用 localStorage，彼此不混存。卡片與計時不會自動保存。收藏只儲存商品編號、暱稱與初次收藏日期，不儲存心事內容。複製權限不足時會提供可手動複製的文字。

本次已測項目與尚需瀏覽器驗收的項目請見 TESTING.md。沒有實際驗證成功的部分不視為已通過。
