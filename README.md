# Timer Bridge

魔方计时器数据格式互转工具。支持 csTimer、DCTimer、TwistyTimer 之间的数据转换，设计上易于扩展以支持更多计时器。

> 本仓库仅包含桥接工具代码。`cstimer/`、`DCTimer-Android/`、`TwistyTimer/` 目录为格式研究参考，不参与构建，未包含在版本控制中。

## 支持的计时器

| 计时器 | 导入格式 | 导出格式 |
|--------|---------|---------|
| csTimer | JSON, CSV | JSON |
| DCTimer | SQLite (spdcube.db) | SQLite |
| TwistyTimer | CSV (备份/外部), SQLite | CSV |

## 使用方式

### CLI

```bash
# 自动检测源格式，转换为目标格式
timer-bridge convert input.json twistytimer -o output.csv

# 手动指定源格式（当自动检测失败时）
timer-bridge convert spdcube.db cstimer -f dctimer -o output.json

# 查看可用适配器
timer-bridge list
```

### Web

构建后通过本地服务器打开（Chrome 不支持从 `file://` 加载 ES module）：

```bash
node apps/web/serve.js
# 打开 http://localhost:8080
```

开发模式：

```bash
cd apps/web
pnpm dev
```

## 项目结构

```
timer-bridge/
├── packages/
│   ├── core/              # 中间格式 + BridgeRegistry + 魔方类型标准化
│   ├── adapter-cstimer/   # csTimer 适配器
│   ├── adapter-dctimer/   # DCTimer 适配器
│   ├── adapter-twistytimer/ # TwistyTimer 适配器
│   └── cli/               # 命令行工具
├── apps/
│   └── web/               # Web 拖拽转换应用
├── references/
│   ├── cstimer/           # [参考] csTimer 源码 (不参与构建)
│   ├── DCTimer-Android/   # [参考] DCTimer 源码 (不参与构建)
│   └── TwistyTimer/       # [参考] TwistyTimer 源码 (不参与构建)
```

## 架构

所有转换均经过统一中间格式 (Intermediate Format)：

```
输入文件 → detect() → import() → [IF] → export() → 输出文件
```

新增计时器只需新建 `packages/adapter-xxx/` 并实现 `Adapter` 接口：

```typescript
interface Adapter {
  id: string
  name: string
  detect(input: string | Uint8Array, filename?: string): boolean
  import(input: string | Uint8Array, filename?: string): TimerData | Promise<TimerData>
  export(data: TimerData): string | Uint8Array | Promise<string | Uint8Array>
  supportedExtensions(): string[]
}
```

在 CLI 和 Web 中各注册一行即可：

```typescript
registry.register('xxx', XxxAdapter)
```

## 开发

```bash
pnpm install
pnpm -r build
pnpm -r test
```

## 协议

MIT
