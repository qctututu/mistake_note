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

```
D:\Study\mistake_note\
├── backend/
│   ├── app.py                   # Flask API 服务
│   ├── models.py                # 数据库模型 & CRUD
│   ├── spaced_repetition.py     # SM-2 遗忘曲线算法
│   ├── question_modifier.py     # 规则引擎变形（备用）
│   ├── ai_model.py              # AI 模型客户端（OpenAI/DeepSeek）
│   ├── knowledge_base.py        # 知识库（RAG 文件上传 & FTS5 检索）
│   ├── requirements.txt
│   └── data/
│       ├── mistake_note.db      # SQLite 数据库（自动创建）
│       └── kb_files/            # 知识库上传文件存放目录
├── frontend/
│   ├── index.html               # SPA 主页面
│   ├── css/style.css            # 样式（响应式 + 弹窗动画 + AI 页面）
│   └── js/
│       ├── api.js               # 前端 API 层（含 AI & KB 接口）
│       └── app.js               # SPA 路由 & 页面逻辑
├── logs/                         # 运行日志目录（自动创建）
│   └── backend.log              # 后端运行日志
├── start.bat                    # 一键启动脚本（日志 → logs/backend.log）
├── start.ps1                    # PowerShell 启动脚本
└── README.md
```

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
| GET | /api/health | 健康检查 |
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
| POST | /api/practice/compare | 对比变形题答案 |

### AI 模型配置
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/ai/config | 获取当前配置 |
| POST | /api/ai/config | 保存配置 |
| DELETE | /api/ai/config | 清除配置 |
| POST | /api/ai/test | 测试连接 |
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

Made with 🦞 by 小龙虾
