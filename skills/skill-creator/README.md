# 🛠️ Skill Creator（技能建立工具）

> 幫你從零開始打造、測試、評估與改進小龍蝦技能的萬能工具箱 🦞🔧

## ✨ 這個技能可以做什麼？

- 📝 建立全新的技能，自動產生 `SKILL.md` 與相關檔案
- 🧪 產生測試案例，驗證技能是否會在正確的提示詞下被觸發
- 📊 執行評估（eval），檢查技能的準確度與表現
- 🏆 進行 benchmark 比較，看看新版技能是不是真的比舊版更強
- 🔄 根據評估結果，自動迭代改進技能的描述與觸發條件

## 📦 安裝方式

### 安裝到目前值班的小龍蝦

在 Telegram 對話中輸入：

```
/skills add skill-creator
```

### 安裝為全域技能（所有小龍蝦共用）

```
/skills add skill-creator -g
```

## ⚙️ 需要的設定

這個技能需要以下環境：

- **Python 3** — 用來執行各種腳本
- **`claude` CLI** — 需要已安裝並完成驗證，用於觸發評估和自動改進功能
- **PyYAML** — 如果沒有的話，執行 `python3 -m pip install pyyaml` 安裝

> 💡 不需要額外的 API key，`claude` CLI 設定好就可以直接使用！

## 💬 提示詞範例

```text
幫我建立一個新技能，可以把客戶的 bug 回報整理成 release note
改進我們 spreadsheet-cleanup 技能的觸發描述，讓它在遇到凌亂的 CSV 時能正確啟動
評估一下我的翻譯技能表現如何，跑一次完整的 eval
Benchmark 比較新舊兩個版本的發票處理技能，看誰比較準
幫我檢查這個技能的 SKILL.md 格式有沒有寫對
```

## 📝 輸出範例

根據不同的操作，你會看到不同的輸出：

**建立技能時** — 會產生完整的技能資料夾，包含 `SKILL.md`、腳本檔案和測試案例

**執行評估時** — 會輸出 JSON 報告：

```
✅ skill: my-awesome-skill
   trigger accuracy: 92%
   results: 23/25 correct
```

**Benchmark 比較時** — 會產生 `benchmark.json` 和 `benchmark.md`，清楚列出各版本的得分差異

## ⚠️ 注意事項

- 這是**進階技能**，適合想要自己建立或改進技能的學員使用
- 必須先安裝並驗證好 `claude` CLI，否則評估和自動改進功能無法使用
- 執行指令時建議先 `cd skills/skill-creator`，避免路徑問題
- 內建的 eval-viewer 可以在瀏覽器中檢視評估結果，方便視覺化比較

## 🔗 延伸閱讀

- 技術細節請參考 [SKILL.md](SKILL.md)
- 資料格式與 schema 說明：[references/schemas.md](references/schemas.md)
- 評估檢視器：[eval-viewer/](eval-viewer/) 目錄
- 自動化代理腳本：[agents/](agents/) 目錄
