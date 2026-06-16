# 📖 错题本 - 高中生专属智能学习工具

基于 **SM-2 遗忘曲线** + **AI 变形题** + **RAG 知识库** 的全功能错题管理系统。

## ✨ 功能

| 功能 | 说明 |
|------|------|
| ✏️ **录入错题** | 记录题目、答案、错因、知识点标签、难度、来源 |
| 📂 **分类浏览** | 按科目/知识点筛选，搜索，排序，编辑/删除 |
| 🔄 **复习模式** | SM-2 遗忘曲线算法，每天推荐到期题目，自评复习质量 |
| 🤖 **AI 模型配置** | 支持 OpenAI / DeepSeek / 自定义 API，一键测试连接 |
| 🎯 **练习模式（AI 驱动）** | 调用 AI 生成变形题，真正检验理解能力，支持 RAG 增强 |
| 📚 **知识库（RAG）** | 上传学习资料，AI 自动检索相关内容作为上下文 |
| 📈 **学习统计** | 各科分布、难度分布、掌握率、复习质量、30 天复习预测 |

## 🚀 快速启动

### 方案一：双击运行（推荐）

```
双击 start.bat
```

会自动安装依赖 → 启动后端 → 打开浏览器。

### 方案二：手动启动

```bash
# 1. 安装后端依赖
cd backend
pip install -r requirements.txt

# 2. 启动后端
python app.py

# 3. 浏览器打开 frontend/index.html
```

### 初次使用

1. 浏览器打开 `frontend/index.html`
2. 进入「✏️ 录入」页面添加几道错题
3. 可选：进入「🤖 AI 模型」填入 API Key 并保存以启用 AI 变形题
4. 可选：进入「📚 知识库」上传学习资料以启用 RAG
5. 进入「🎯 练习模式」生成 AI 变形题
6. 进入「🔄 复习」按 SM-2 算法到期复习

## 🏗️ 项目结构

```text
mistake_note/
├── backend/
│   ├── app.py                       # Flask 入口，注册全部路由
│   ├── requirements.txt
│   ├── routes/                      # API 接口层
│   │   ├── __init__.py
│   │   ├── subjects.py
│   │   ├── questions.py
│   │   ├── review.py
│   │   ├── practice.py
│   │   ├── ai.py
│   │   ├── knowledge_base.py
│   │   └── system.py
│   ├── services/                    # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── spaced_repetition.py
│   │   ├── question_modifier.py
│   │   ├── ai_model.py
│   │   └── knowledge_base.py
│   ├── repository/                  # 数据访问层
│   │   ├── __init__.py
│   │   └── database.py
│   └── data/
│       ├── mistake_note.db          # SQLite 数据库（自动创建）
│       ├── images/                  # 上传图片目录
│       └── knowledge_base/          # 知识库文件目录
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js
│       ├── app.js                   # 启动脚本（只做装配）
│       ├── core/                    # 公共能力层
│       │   ├── ui.js
│       │   ├── format.js
│       │   ├── charts.js
│       │   ├── data.js
│       │   └── runtime.js
│       └── pages/                   # 页面模块层
│           ├── dashboard.js
│           ├── add.js
│           ├── browse.js
│           ├── review.js
│           ├── stats.js
│           ├── practice.js
│           ├── ai_model.js
│           └── knowledge_base.js
├── logs/
│   └── backend.log
├── test_files/
├── batch_import_kb.py
├── fix_encoding.py
├── start.bat
├── start.ps1
└── README.md
```

## 🧱 分层架构说明

- 后端采用三层：`routes`（HTTP 接口）→ `services`（业务逻辑）→ `repository`（数据访问）
- 前端采用三层：`pages`（页面功能）→ `core`（跨页面公共能力）→ `app.js`（启动装配）
- 这样可以降低耦合，便于后续新增页面、替换数据源、扩展 AI 能力

## 🤖 AI 模型配置

支持以下模型服务商：

| 服务商 | 默认地址 | 推荐模型 |
|--------|----------|----------|
| 🟢 **OpenAI** | https://api.openai.com | gpt-4o / gpt-4o-mini / gpt-3.5-turbo |
| 🔴 **DeepSeek** | https://api.deepseek.com | deepseek-chat |
| ⚙️ **自定义** | 任意兼容 OpenAI 格式的端点 | Ollama、Azure OpenAI 等 |

### 配置步骤
1. 侧边栏点击「🤖 AI 模型」
2. 选择模型类型，填入 API Key
3. 点击「🧪 测试连接」验证
4. 点击「💾 保存配置」

### 练习模式流程
```
点击「练习模式」→ 检查 AI 配置
  ├─ 未配置 → 弹窗提醒 → 跳转配置页面 / 返回概览
  └─ 已配置 → AI 生成变形题（含知识库上下文）
```

## 📚 知识库（RAG 检索增强生成）

支持上传 `.txt` `.md` `.csv` `.pdf` 格式的学习资料：

- **自动分块**：段落感知，每块约 500 字
- **FTS5 全文检索**：SQLite 内置搜索引擎，快速匹配
- **RAG 闭环**：AI 生成变形题时自动检索相关上下文，生成更有针对性的题目
- **文件管理**：上传、查看片段数量、删除

## 📡 API 接口

### 基础 & 错题
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | /api/subjects | 科目列表 / 新增 |
| GET/POST | /api/questions | 错题列表（分页）/ 新增 |
| GET/PUT/DELETE | /api/questions/:id | 错题详情 / 更新 / 删除 |

### 复习（SM-2）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/review/due | 今日到期复习题 |
| POST | /api/review/submit | 提交复习结果 |
| GET | /api/review/history/:id | 复习历史 |
| GET | /api/review/forecast | 复习量预测 |

### 练习（AI 驱动）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/practice/generate | 生成变形题（AI 优先，失败后降级规则引擎） |
| POST | /api/practice/grade | AI 批改练习答案 |
| POST | /api/practice/analyze | AI 生成错因与改进建议 |

### AI 模型配置
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/ai/config | 获取当前配置 |
| POST | /api/ai/config | 保存配置 |
| DELETE | /api/ai/config | 清除配置 |
| GET/POST | /api/ai/test | 测试连接（POST 时可携带临时配置） |
| POST | /api/ai/generate | 基于单题生成变形题 |
| GET | /api/ai/status | 返回配置状态（是否可用） |

### 知识库
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/kb/init | 初始化知识库（建表） |
| POST | /api/kb/upload | 上传文件 |
| GET | /api/kb/files | 文件列表 |
| DELETE | /api/kb/files/:id | 删除文件 |
| POST | /api/kb/search | 全文检索 |

### 统计
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stats | 学习统计数据 |

### 系统
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/upload-image | 上传答案图片 |
| GET | /uploads/images/:filename | 访问上传图片 |

## 🧠 遗忘曲线算法

使用 [SM-2](https://en.wikipedia.org/wiki/SuperMemo) 算法：

- **正确** → 间隔增长（1天 → 6天 → 等比增长）
- **部分正确** → 中等增长
- **错误** → 重置间隔，重新开始
- **易度因子 (EF)** 动态调整，初始 2.5，根据复习质量上下浮动
- **下次复习日期** = 当前日期 + 间隔 × EF

## 🎯 练习模式两种变形方式

### 1. 规则引擎（默认降级）
数字偏移、变量替换、同义改写，无需外部依赖。

### 2. AI 生成（推荐）
配置 AI 模型后自动启用，AI 理解题目语义后生成高质量的变形题，并可结合知识库上下文。

## 🔧 扩展思路

- [x] 接入 **LLM** 做更智能的题目变形（OpenAI / DeepSeek）
- [x] **RAG 知识库** 上传资料增强生成质量
- [ ] 导出报告（PDF/CSV）
- [ ] 支持图片上传（数学题图、手写笔记）
- [ ] 多用户 / 云端同步
- [ ] 移动端 App（已有响应式基础）
- [ ] 语音输入错题
- [ ] 错题拍照自动识别（OCR）

---
