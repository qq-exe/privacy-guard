# Loose Lips Filter（守口如瓶过滤器）— #BuildHybridAI 2026

> **一句话**：按下发送之前，端侧 AI 拦下不该离开你电脑的内容——全程离线，数据永不外传。

**赛事**: #BuildHybridAI (Google Firebase)｜$30,000｜截止 2026-11-30（⚠️ 仅剩 13 天）  
\*\*注册状态\*\*: ✅ 已报名 (Devpost solo)｜\*\*目标奖项：Best Web/Chrome App $3,000\*\*（独立赛道，避开 Grand Prize 正面竞争）

## 前 30 秒 Pitch（痛点场景开场）

"你把一张报销单截图粘进 AI 聊天框，没注意到角上有你的手机号和身份证号——云端从此永久存了一份。守口如瓶过滤器在你的输入框里实时扫描，敏感内容在按下回车前就被标出来，一键脱敏改写。因为检测用的是设备端 Gemini Nano，你的隐私从头到尾没离开过这台电脑。"

## 核心功能（严格 3 个，对照 Firebase AI Logic hybrid inference 评分项）

1. **实时端侧检测**（on-device）：Chrome Prompt API (Gemini Nano) + 正则双引擎扫描输入框——手机号/身份证/银行卡/邮箱/门牌地址，红色下划线标注
2. **一键脱敏改写**（on-device inference）：端侧模型生成脱敏版本（保留语义、替换敏感实体），用户点确认才替换
3. **云端降级通路**（hybrid inference 评分核心）：长文档（>8K tokens）或端侧模型不可用时走 Firebase AI Logic 云端，页面明确显示"本次检测在云端进行"——诚实展示 hybrid 决策，正是 Grand Prize 评分点

## Firebase 接入进度（2026-11-17）
- ✅ Firebase 项目已建：privacy-guard-ab2b1（MFA 后全自动创建）
- ✅ Web 应用已注册：Loose Lips Filter（firebase-config.js 已写入）
- ✅ Gemini Developer API / AI Logic 已启用（App Check 自动启用）
- ✅ App Check 调试令牌已注册（dev-token: 6c1f3a2b-…）
- ✅ 代码真实接入：bg.js import firebase/ai → getGenerativeModel → cloudScan（esbuild 打包为 bg.bundle.js，npm run build）
- ⚠️ 云端调用运行时仍 401（App Check 令牌交换在当前网络环境失败；生产部署需 reCAPTCHA Enterprise 密钥 + 干净网络）。失败时自动降级端侧正则引擎——混合决策与降级逻辑正是评分点，README 如实记录
- 📌 用户开启代理（7890）后重测即可打通云端

## 提交材料 checklist（截止 11-30 2PM PT，提前 2 小时交）

- [ ] 可运行 demo（Chrome 扩展 + 演示页）
- [ ] 公开 GitHub repo + 开源 LICENSE 文件（仓库根可见）
- [ ] 代码里真实 import 并调用 Firebase AI Logic（不是 README 提一嘴）
- [ ] 3 分钟演示视频（端侧检测→脱敏→云端降级三连展示）
- [ ] App Check debug token 配置说明
- [ ] 文本描述：Firebase AI Logic 用法 + 功能摘要 + 价值主张

## 目录

- `manifest.json` — MV3 扩展清单
- `content.js` — 输入框扫描 + 下划线标注
- `bg.js` — Gemini Nano (端侧) / Firebase AI Logic (云端) 混合调度
