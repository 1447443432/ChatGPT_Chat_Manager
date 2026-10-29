# 架构与实现说明

## 模块职责

| 模块 | 责任 | 输入 / 输出 |
| --- | --- | --- |
| `manifest.json` | 声明 MV3、存储、活动标签页权限及指定域名内容脚本 | 浏览器启动扩展 |
| `content.js` | 扫描 ChatGPT 页面链接、显示框选层、定位聊天 | 消息 `SCAN` / `FRAME` / `HIGHLIGHT` |
| `popup.js` | 读写本地规则、展示列表、判断保护、导出 CSV | `chrome.storage.local`、内容脚本消息 |
| `popup.html` / `style.css` | UI 结构及样式 | 弹窗界面 |

## 存储设计

`chrome.storage.local` 使用下列键：

```json
{
  "keywords": "MongoDB, Kafka",
  "whitelist": {
    "chat-id-placeholder": {
      "title": "某条聊天",
      "url": "https://chatgpt.com/c/chat-id-placeholder",
      "createdAt": "2026-10-29T00:00:00.000Z"
    }
  },
  "scan": [],
  "scanAt": "2026-10-29T00:00:00.000Z"
}
```

当前版本使用聊天 ID 为键，**不按账号隔离**，也不具备完整历史聊天清单。扩展清除存储后白名单会丢失；CSV 只能导出当次扫描清单，不能作为完整白名单备份。

## 扫描算法

1. 在当前页面遍历 `a[href]`。
2. 匹配地址路径里的 `/c/<id>`。
3. 从 `title` / `innerText` / `textContent` 获取标题，去除空白并限制长度。
4. 过滤不具备尺寸的链接，按 ID 去重。
5. 对存在 URL 或 DOM 项目标记的元素尝试设置 `project=true`。

**边界：** 这只扫描当前 DOM 已加载的链接，没有访问服务端历史；“项目”识别并不可靠，不能作为删除前唯一保护手段。

## 框选算法

1. 用户点击 `FRAME` 后，在网页添加全屏透明遮罩，附提示与选择矩形。
2. 监听 `pointerdown / pointermove / pointerup` 绘制矩形。
3. 用矩形交集面积 ÷ 链接元素面积计算比例，≥30% 则加入 `whitelist`。
4. 区域宽或高小于 12px 不保存；按 Esc 取消。
5. 保存到 `chrome.storage.local.whitelist`，以聊天 ID 为唯一键。

框选使用**当前显示的网页元素坐标**；不会分析上传图片，也不会滚动遍历全部列表。

## 保留判定

```js
protected = Boolean(whitelist[chat.id])
  || keywords.some(word => chat.title.toLowerCase().includes(word))
  || chat.project;
```

手动取消勾选仅移除 `whitelist[id]`，不能覆盖关键词保护。保留状态属于本地预览，不影响 ChatGPT 原生聊天记录。

## 扩展安全边界

- 不使用后台 Service Worker，不配置远端 API，不需要账号登录凭据。
- 操作在指定 ChatGPT 站点与插件本地存储中完成。
- 不拥有任何归档、删除执行逻辑。
- 扩展界面不加载远程 JavaScript，适配 MV3 CSP。
